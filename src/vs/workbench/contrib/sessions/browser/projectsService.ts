/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IChatRequestVariableEntry } from '../../chat/common/attachments/chatVariableEntries.js';
import { IEnablementModel } from '../../chat/common/enablement.js';
import { applyProjectMcpEnablement, buildProjectContextEntries, projectContextCandidates } from './projectContext.js';
import { IPlaceholderGroupSnapshot, IProjectsChangeEvent, IProjectsService, IVespraProject, PROJECT_INSTRUCTIONS_PATH, PROJECT_KNOWLEDGE_DIR, PROJECT_MANIFEST_PATH, manifestToProject, parseProjectManifest, planPlaceholderGroupMigration, serializeProjectManifest } from '../common/projects.js';

const STORAGE_KEY = 'sessions.projects.relayContexts';

interface ISerializedProject {
	readonly id: string;
	readonly name: string;
	readonly createdAt: number;
	readonly icon?: string;
	readonly color?: string;
	readonly workspaceUris?: readonly string[];
	readonly knowledgeUris?: readonly string[];
	readonly defaultAgentId?: string;
	readonly instructionsUri?: string;
	readonly mcpServerIds?: readonly string[];
}

interface ISerializedState {
	readonly projects: readonly ISerializedProject[];
	readonly membership: Readonly<Record<string, string>>;
	readonly activeProjectId?: string;
	readonly migratedGroupIds?: readonly string[];
}

const INSTRUCTIONS_STUB = `# Project instructions

Describe how agents should work in this Vespra project: goals, conventions, and what "done" means.
`;

export class ProjectsService extends Disposable implements IProjectsService {
	declare readonly _serviceBrand: undefined;

	private readonly _projects = new Map<string, IVespraProject>();
	private readonly _membership = new Map<string, string>();
	private readonly _migratedGroupIds = new Set<string>();
	private _activeProjectId: string | undefined;

	private readonly _onDidChange = this._register(new Emitter<IProjectsChangeEvent>());
	readonly onDidChange: Event<IProjectsChangeEvent> = this._onDidChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IFileService private readonly fileService: IFileService,
	) {
		super();
		this.load();
	}

	getProjects(): readonly IVespraProject[] {
		return [...this._projects.values()].sort((a, b) => b.createdAt - a.createdAt);
	}

	getProject(id: string): IVespraProject | undefined {
		return this._projects.get(id);
	}

	getActiveProject(): IVespraProject | undefined {
		return this._activeProjectId ? this._projects.get(this._activeProjectId) : undefined;
	}

	setActiveProject(id: string | undefined): void {
		const next = id && this._projects.has(id) ? id : undefined;
		if (next === this._activeProjectId) {
			return;
		}
		this._activeProjectId = next;
		this.save();
		this._onDidChange.fire({ projectsChanged: false, activeChanged: true, membershipChanged: new Set() });
	}

	async createProject(name: string, workspaceUri?: URI): Promise<IVespraProject> {
		const trimmed = name.trim();
		const project: IVespraProject = {
			id: generateUuid(),
			name: trimmed.length > 0 ? trimmed : 'Project',
			createdAt: Date.now(),
			workspaceUris: workspaceUri ? [workspaceUri] : [],
			knowledgeUris: workspaceUri ? [joinPath(workspaceUri, PROJECT_KNOWLEDGE_DIR)] : [],
			instructionsUri: workspaceUri ? joinPath(workspaceUri, PROJECT_INSTRUCTIONS_PATH) : undefined,
			mcpServerIds: [],
		};
		this._projects.set(project.id, project);
		this._activeProjectId = project.id;
		this.save();
		await this.writeWorkspaceFiles(project);
		this._onDidChange.fire({ projectsChanged: true, activeChanged: true, membershipChanged: new Set() });
		return project;
	}

	renameProject(id: string, name: string): void {
		const current = this._projects.get(id);
		const trimmed = name.trim();
		if (!current || trimmed.length === 0 || trimmed === current.name) {
			return;
		}
		const next = { ...current, name: trimmed };
		this._projects.set(id, next);
		this.save();
		void this.writeWorkspaceFiles(next);
		this._onDidChange.fire({ projectsChanged: true, activeChanged: false, membershipChanged: new Set() });
	}

	deleteProject(id: string): void {
		if (!this._projects.delete(id)) {
			return;
		}
		const moved = new Set<string>();
		for (const [sessionId, projectId] of this._membership) {
			if (projectId === id) {
				this._membership.delete(sessionId);
				moved.add(sessionId);
			}
		}
		const activeChanged = this._activeProjectId === id;
		if (activeChanged) {
			this._activeProjectId = undefined;
		}
		this.save();
		this._onDidChange.fire({ projectsChanged: true, activeChanged, membershipChanged: moved });
	}

	getProjectOfSession(sessionId: string): IVespraProject | undefined {
		const projectId = this._membership.get(sessionId);
		return projectId ? this._projects.get(projectId) : undefined;
	}

	getSessionIds(projectId: string): readonly string[] {
		const ids: string[] = [];
		for (const [sessionId, owner] of this._membership) {
			if (owner === projectId) {
				ids.push(sessionId);
			}
		}
		return ids;
	}

	assignSession(sessionId: string, projectId: string | undefined): void {
		const current = this._membership.get(sessionId);
		if (projectId === undefined) {
			if (!this._membership.delete(sessionId)) {
				return;
			}
		} else if (!this._projects.has(projectId) || current === projectId) {
			return;
		} else {
			this._membership.set(sessionId, projectId);
		}
		this.save();
		this._onDidChange.fire({ projectsChanged: false, activeChanged: false, membershipChanged: new Set([sessionId]) });
	}

	migratePlaceholderGroups(groups: readonly IPlaceholderGroupSnapshot[]): readonly IVespraProject[] {
		const created: IVespraProject[] = [];
		for (const migration of planPlaceholderGroupMigration(groups, this._migratedGroupIds)) {
			const project: IVespraProject = {
				id: generateUuid(),
				name: migration.projectName,
				createdAt: Date.now(),
				workspaceUris: [],
				knowledgeUris: [],
				mcpServerIds: [],
			};
			this._projects.set(project.id, project);
			for (const sessionId of migration.sessionIds) {
				this._membership.set(sessionId, project.id);
			}
			this._migratedGroupIds.add(migration.groupId);
			created.push(project);
		}
		if (created.length > 0) {
			this._activeProjectId = created[0].id;
			this.save();
			this._onDidChange.fire({
				projectsChanged: true,
				activeChanged: true,
				membershipChanged: new Set(created.flatMap(project => this.getSessionIds(project.id))),
			});
		}
		return created;
	}

	async readWorkspaceManifest(workspace: URI): Promise<IVespraProject | undefined> {
		const file = joinPath(workspace, PROJECT_MANIFEST_PATH);
		try {
			if (!await this.fileService.exists(file)) {
				return undefined;
			}
			const contents = await this.fileService.readFile(file);
			const parsed = parseProjectManifest(contents.value.toString(), workspace);
			if (!parsed) {
				return undefined;
			}
			return manifestToProject(parsed, workspace);
		} catch {
			return undefined;
		}
	}

	async resolveContextEntries(project: IVespraProject): Promise<IChatRequestVariableEntry[]> {
		const candidates = projectContextCandidates(project);
		const instructions: URI[] = [];
		for (const uri of candidates.instructions) {
			if (await this.exists(uri)) {
				instructions.push(uri);
				break;
			}
		}
		const knowledge: URI[] = [];
		for (const uri of candidates.knowledge) {
			await this.collectKnowledge(uri, knowledge);
			if (knowledge.length >= 8) {
				break;
			}
		}
		return buildProjectContextEntries({ instructions, knowledge: knowledge.slice(0, 8) });
	}

	applyMcp(project: IVespraProject, model: IEnablementModel): void {
		applyProjectMcpEnablement(model, project);
	}

	private async exists(resource: URI): Promise<boolean> {
		try {
			return await this.fileService.exists(resource);
		} catch {
			return false;
		}
	}

	private async collectKnowledge(resource: URI, into: URI[]): Promise<void> {
		if (into.length >= 8) {
			return;
		}
		try {
			const stat = await this.fileService.stat(resource);
			if (stat.isSymbolicLink) {
				return;
			}
			if (!stat.isDirectory) {
				into.push(resource);
				return;
			}
			const children = await this.fileService.resolve(resource);
			for (const child of children.children ?? []) {
				if (child.isDirectory || child.isSymbolicLink) {
					continue;
				}
				into.push(child.resource);
				if (into.length >= 8) {
					return;
				}
			}
		} catch {
			// Missing knowledge is skipped.
		}
	}

	private async writeWorkspaceFiles(project: IVespraProject): Promise<void> {
		const workspace = project.workspaceUris[0];
		if (!workspace) {
			return;
		}
		try {
			const folder = joinPath(workspace, '.vespra');
			await this.fileService.createFolder(folder);
			await this.fileService.createFolder(joinPath(workspace, PROJECT_KNOWLEDGE_DIR));
			const manifest = joinPath(workspace, PROJECT_MANIFEST_PATH);
			await this.fileService.writeFile(manifest, VSBuffer.fromString(serializeProjectManifest(project, workspace)));
			const instructions = project.instructionsUri ?? joinPath(workspace, PROJECT_INSTRUCTIONS_PATH);
			if (!await this.fileService.exists(instructions)) {
				await this.fileService.writeFile(instructions, VSBuffer.fromString(INSTRUCTIONS_STUB));
			}
		} catch {
			// A remote or untrusted root can refuse the write; the profile copy still stands.
		}
	}

	private load(): void {
		const raw = this.storageService.get(STORAGE_KEY, StorageScope.PROFILE);
		if (!raw) {
			return;
		}
		try {
			const parsed = JSON.parse(raw) as Partial<ISerializedState>;
			if (Array.isArray(parsed.projects)) {
				for (const project of parsed.projects) {
					const revived = reviveProject(project);
					if (revived) {
						this._projects.set(revived.id, revived);
					}
				}
			}
			if (parsed.membership && typeof parsed.membership === 'object') {
				for (const [sessionId, projectId] of Object.entries(parsed.membership)) {
					if (typeof projectId === 'string' && this._projects.has(projectId)) {
						this._membership.set(sessionId, projectId);
					}
				}
			}
			if (typeof parsed.activeProjectId === 'string' && this._projects.has(parsed.activeProjectId)) {
				this._activeProjectId = parsed.activeProjectId;
			}
			if (Array.isArray(parsed.migratedGroupIds)) {
				for (const id of parsed.migratedGroupIds) {
					if (typeof id === 'string') {
						this._migratedGroupIds.add(id);
					}
				}
			}
		} catch {
			// Ignore corrupt profile data.
		}
	}

	private save(): void {
		if (this._projects.size === 0 && this._migratedGroupIds.size === 0) {
			this.storageService.remove(STORAGE_KEY, StorageScope.PROFILE);
			return;
		}
		const state: ISerializedState = {
			projects: [...this._projects.values()].map(serializeProject),
			membership: Object.fromEntries(this._membership),
			...(this._activeProjectId ? { activeProjectId: this._activeProjectId } : {}),
			...(this._migratedGroupIds.size > 0 ? { migratedGroupIds: [...this._migratedGroupIds] } : {}),
		};
		this.storageService.store(STORAGE_KEY, JSON.stringify(state), StorageScope.PROFILE, StorageTarget.USER);
	}
}

function serializeProject(project: IVespraProject): ISerializedProject {
	return {
		id: project.id,
		name: project.name,
		createdAt: project.createdAt,
		...(project.icon ? { icon: project.icon } : {}),
		...(project.color ? { color: project.color } : {}),
		workspaceUris: project.workspaceUris.map(uri => uri.toString()),
		knowledgeUris: project.knowledgeUris.map(uri => uri.toString()),
		...(project.defaultAgentId ? { defaultAgentId: project.defaultAgentId } : {}),
		...(project.instructionsUri ? { instructionsUri: project.instructionsUri.toString() } : {}),
		mcpServerIds: project.mcpServerIds,
	};
}

function reviveProject(project: ISerializedProject | undefined): IVespraProject | undefined {
	if (!project || typeof project.id !== 'string' || typeof project.name !== 'string') {
		return undefined;
	}
	return {
		id: project.id,
		name: project.name,
		createdAt: typeof project.createdAt === 'number' ? project.createdAt : Date.now(),
		...(typeof project.icon === 'string' ? { icon: project.icon } : {}),
		...(typeof project.color === 'string' ? { color: project.color } : {}),
		workspaceUris: reviveUris(project.workspaceUris),
		knowledgeUris: reviveUris(project.knowledgeUris),
		...(typeof project.defaultAgentId === 'string' ? { defaultAgentId: project.defaultAgentId } : {}),
		...(typeof project.instructionsUri === 'string' ? { instructionsUri: URI.parse(project.instructionsUri) } : {}),
		mcpServerIds: Array.isArray(project.mcpServerIds) ? project.mcpServerIds.filter((id): id is string => typeof id === 'string') : [],
	};
}

function reviveUris(values: readonly string[] | undefined): URI[] {
	if (!Array.isArray(values)) {
		return [];
	}
	const uris: URI[] = [];
	for (const value of values) {
		if (typeof value === 'string') {
			try {
				uris.push(URI.parse(value));
			} catch {
				// Skip a single bad URI.
			}
		}
	}
	return uris;
}
