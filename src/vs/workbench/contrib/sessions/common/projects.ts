/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatRequestVariableEntry } from '../../chat/common/attachments/chatVariableEntries.js';
import { IEnablementModel } from '../../chat/common/enablement.js';

/** Files kept with a local workspace so a Relay Context travels with the repo. */
export const PROJECT_MANIFEST_PATH = '.vespra/project.json';
export const PROJECT_INSTRUCTIONS_PATH = '.vespra/INSTRUCTIONS.md';
export const PROJECT_KNOWLEDGE_DIR = '.vespra/knowledge';
export const PROJECT_AGENTS_PATH = 'AGENTS.md';

/** How many knowledge files a send attaches before later summarization. */
export const MAX_PROJECT_KNOWLEDGE_FILES = 8;

/**
 * A Vespra Project (Relay Context): a durable pack sessions join —
 * workspace, instructions, knowledge, and MCP enablement.
 */
export interface IVespraProject {
	readonly id: string;
	readonly name: string;
	readonly createdAt: number;
	readonly icon?: string;
	readonly color?: string;
	readonly workspaceUris: readonly URI[];
	readonly knowledgeUris: readonly URI[];
	readonly defaultAgentId?: string;
	readonly instructionsUri?: URI;
	readonly mcpServerIds: readonly string[];
}

export interface IProjectManifest {
	readonly id: string;
	readonly name: string;
	readonly instructions?: string;
	readonly knowledge?: readonly string[];
	readonly mcpServerIds?: readonly string[];
	readonly defaultAgentId?: string;
}

export interface IPlaceholderGroupSnapshot {
	readonly id: string;
	readonly name: string;
	readonly parentId?: string;
	readonly sessionIds: readonly string[];
}

export interface IPlaceholderMigration {
	readonly groupId: string;
	readonly projectName: string;
	readonly sessionIds: readonly string[];
}

export interface IProjectsChangeEvent {
	readonly projectsChanged: boolean;
	readonly activeChanged: boolean;
	readonly membershipChanged: ReadonlySet<string>;
}

export interface IProjectsService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<IProjectsChangeEvent>;

	getProjects(): readonly IVespraProject[];
	getProject(id: string): IVespraProject | undefined;
	getActiveProject(): IVespraProject | undefined;
	setActiveProject(id: string | undefined): void;

	createProject(name: string, workspaceUri?: URI): Promise<IVespraProject>;
	renameProject(id: string, name: string): void;
	deleteProject(id: string): void;

	/** Save every dirty file under the workspace into the knowledge folder. */
	addKnowledge(id: string): Promise<number>;
	removeKnowledge(id: string, uri: URI): void;
	/** Existing files the project attaches, including what the knowledge folder holds. */
	listKnowledgeFiles(project: IVespraProject): Promise<URI[]>;

	getProjectOfSession(sessionId: string): IVespraProject | undefined;
	getSessionIds(projectId: string): readonly string[];
	assignSession(sessionId: string, projectId: string | undefined): void;

	/**
	 * Turns a sidebar group named "Projects" (and its child groups) into real
	 * projects once. Generic session groups are left in place.
	 */
	migratePlaceholderGroups(groups: readonly IPlaceholderGroupSnapshot[]): readonly IVespraProject[];

	/** Reads `.vespra/project.json` from a workspace without writing profile storage. */
	readWorkspaceManifest(workspace: URI): Promise<IVespraProject | undefined>;
	/** Instructions and knowledge files that exist, capped for a single send. */
	resolveContextEntries(project: IVespraProject): Promise<IChatRequestVariableEntry[]>;
	applyMcp(project: IVespraProject, model: IEnablementModel): void;
}

export const IProjectsService = createDecorator<IProjectsService>('projectsService');

export function isProjectsPlaceholderName(name: string): boolean {
	return name.trim().toLowerCase() === 'projects';
}

/** Plans which placeholder groups become projects. Already-migrated ids are skipped. */
export function planPlaceholderGroupMigration(groups: readonly IPlaceholderGroupSnapshot[], alreadyMigrated: ReadonlySet<string>): readonly IPlaceholderMigration[] {
	const migrations: IPlaceholderMigration[] = [];
	for (const group of groups) {
		if (group.parentId !== undefined || !isProjectsPlaceholderName(group.name) || alreadyMigrated.has(group.id)) {
			continue;
		}
		const children = groups.filter(candidate => candidate.parentId === group.id);
		if (children.length === 0) {
			if (group.sessionIds.length > 0) {
				migrations.push({ groupId: group.id, projectName: group.name.trim(), sessionIds: group.sessionIds });
			}
			continue;
		}
		for (const child of children) {
			if (alreadyMigrated.has(child.id)) {
				continue;
			}
			migrations.push({ groupId: child.id, projectName: child.name.trim() || group.name.trim(), sessionIds: child.sessionIds });
		}
	}
	return migrations;
}

export function serializeProjectManifest(project: IVespraProject, workspace: URI): string {
	const manifest: IProjectManifest = {
		id: project.id,
		name: project.name,
		instructions: project.instructionsUri ? relativeToWorkspace(workspace, project.instructionsUri) : PROJECT_INSTRUCTIONS_PATH,
		knowledge: project.knowledgeUris.map(uri => relativeToWorkspace(workspace, uri)),
		...(project.mcpServerIds.length > 0 ? { mcpServerIds: project.mcpServerIds } : {}),
		...(project.defaultAgentId ? { defaultAgentId: project.defaultAgentId } : {}),
	};
	return JSON.stringify(manifest, undefined, 2);
}

export function parseProjectManifest(raw: string, workspace: URI): IProjectManifest & { workspace: URI } | undefined {
	try {
		const parsed = JSON.parse(raw) as Partial<IProjectManifest>;
		if (!parsed || typeof parsed.id !== 'string' || typeof parsed.name !== 'string') {
			return undefined;
		}
		return {
			id: parsed.id,
			name: parsed.name,
			workspace,
			instructions: typeof parsed.instructions === 'string' ? parsed.instructions : undefined,
			knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge.filter((entry): entry is string => typeof entry === 'string') : undefined,
			mcpServerIds: Array.isArray(parsed.mcpServerIds) ? parsed.mcpServerIds.filter((entry): entry is string => typeof entry === 'string') : undefined,
			defaultAgentId: typeof parsed.defaultAgentId === 'string' ? parsed.defaultAgentId : undefined,
		};
	} catch {
		return undefined;
	}
}

export function manifestToProject(manifest: IProjectManifest, workspace: URI, createdAt = Date.now()): IVespraProject {
	const instructions = manifest.instructions ?? PROJECT_INSTRUCTIONS_PATH;
	return {
		id: manifest.id,
		name: manifest.name,
		createdAt,
		workspaceUris: [workspace],
		instructionsUri: resolveWorkspacePath(workspace, instructions),
		knowledgeUris: (manifest.knowledge ?? []).map(path => resolveWorkspacePath(workspace, path)),
		mcpServerIds: manifest.mcpServerIds ?? [],
		...(manifest.defaultAgentId ? { defaultAgentId: manifest.defaultAgentId } : {}),
	};
}

export function instructionCandidates(project: IVespraProject): URI[] {
	const uris: URI[] = [];
	if (project.instructionsUri) {
		uris.push(project.instructionsUri);
	}
	const root = project.workspaceUris[0];
	if (root) {
		const bundled = joinPath(root, PROJECT_INSTRUCTIONS_PATH);
		const agents = joinPath(root, PROJECT_AGENTS_PATH);
		if (!uris.some(uri => uri.toString() === bundled.toString())) {
			uris.push(bundled);
		}
		if (!uris.some(uri => uri.toString() === agents.toString())) {
			uris.push(agents);
		}
	}
	return uris;
}

export function knowledgeCandidates(project: IVespraProject): URI[] {
	return project.knowledgeUris.slice(0, MAX_PROJECT_KNOWLEDGE_FILES);
}

function relativeToWorkspace(workspace: URI, target: URI): string {
	const base = workspace.path.endsWith('/') ? workspace.path : `${workspace.path}/`;
	if (target.scheme === workspace.scheme && target.path.startsWith(base)) {
		return target.path.slice(base.length);
	}
	return target.toString();
}

function resolveWorkspacePath(workspace: URI, pathOrUri: string): URI {
	if (pathOrUri.includes('://')) {
		return URI.parse(pathOrUri);
	}
	const parts = pathOrUri.split('/').filter(part => part.length > 0);
	return joinPath(workspace, ...parts);
}
