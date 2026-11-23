/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileOperationError, FileOperationResult, IFileService, IFileStat } from '../../../../../platform/files/common/files.js';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { ContributionEnablementState, IEnablementModel } from '../../../chat/common/enablement.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { ProjectsService } from '../../browser/projectsService.js';
import { manifestToProject, parseProjectManifest, planPlaceholderGroupMigration, PROJECT_INSTRUCTIONS_PATH, PROJECT_KNOWLEDGE_DIR, resolveProjectSessions, serializeProjectManifest } from '../../common/projects.js';

suite('Vespra Projects', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('turns a Projects placeholder and its children into projects once', () => {
		const groups = [
			{ id: 'root', name: 'Projects', sessionIds: ['loose'] },
			{ id: 'child', name: 'Billing', parentId: 'root', sessionIds: ['s1'] },
			{ id: 'notes', name: 'Notes', sessionIds: ['s2'] },
		];

		const first = planPlaceholderGroupMigration(groups, new Set());
		assert.deepStrictEqual(first.map(item => ({ name: item.projectName, sessions: [...item.sessionIds] })), [
			{ name: 'Billing', sessions: ['s1'] },
		]);

		const again = planPlaceholderGroupMigration(groups, new Set(first.map(item => item.groupId)));
		assert.deepStrictEqual(again, []);

		const flat = planPlaceholderGroupMigration([
			{ id: 'root', name: ' projects ', sessionIds: ['s3'] },
		], new Set());
		assert.strictEqual(flat[0]?.projectName, 'projects');
		assert.deepStrictEqual([...flat[0].sessionIds], ['s3']);
	});

	test('resolves member sessions newest first and reports ids that are not loaded', () => {
		const session = (sessionId: string, updatedAt: number, previousIds: string[] = []) => ({
			sessionId,
			updatedAt: constObservable(new Date(updatedAt)),
			previousIdentities: previousIds.map(id => ({ sessionId: id, resource: URI.parse(`test:/${id}`) })),
		});
		const loaded = [
			session('local:old', 10),
			session('local:new', 30),
			session('agent:renamed', 20, ['cli:legacy', 'local:old']),
			session('local:other', 40),
		];

		const resolved = resolveProjectSessions(['local:old', 'cli:legacy', 'missing:1', 'local:new', 'agent:renamed'], loaded);
		assert.deepStrictEqual({
			sessions: resolved.sessions.map(item => item.sessionId),
			unresolvedIds: resolved.unresolvedIds,
		}, {
			sessions: ['local:new', 'agent:renamed', 'local:old'],
			unresolvedIds: ['missing:1'],
		});
	});

	test('round-trips a workspace manifest with relative knowledge paths', () => {
		const workspace = URI.file('/work/app');
		const project = manifestToProject({
			id: 'p1',
			name: 'App',
			instructions: PROJECT_INSTRUCTIONS_PATH,
			knowledge: [PROJECT_KNOWLEDGE_DIR],
			mcpServerIds: ['github'],
		}, workspace, 10);

		const raw = serializeProjectManifest(project, workspace);
		const parsed = parseProjectManifest(raw, workspace);
		assert.ok(parsed);
		assert.strictEqual(parsed.instructions, PROJECT_INSTRUCTIONS_PATH);
		assert.deepStrictEqual(parsed.knowledge, [PROJECT_KNOWLEDGE_DIR]);
		const revived = manifestToProject(parsed, workspace, 10);
		assert.strictEqual(revived.instructionsUri?.toString(), joinPath(workspace, PROJECT_INSTRUCTIONS_PATH).toString());
		assert.strictEqual(revived.knowledgeUris[0]?.toString(), joinPath(workspace, PROJECT_KNOWLEDGE_DIR).toString());
		assert.deepStrictEqual(revived.mcpServerIds, ['github']);
	});

	test('persists projects, membership, and workspace files', async () => {
		const storage = store.add(new InMemoryStorageService());
		const files = new MemoryFiles();
		const service = store.add(new ProjectsService(storage, files.asService(), {
			files: { models: [] },
		} as unknown as ITextFileService));
		const workspace = URI.file('/work/app');

		const project = await service.createProject('Relay', workspace);
		assert.strictEqual(service.getActiveProject()?.id, project.id);
		service.assignSession('session-1', project.id);
		assert.strictEqual(service.getProjectOfSession('session-1')?.name, 'Relay');

		const manifest = await service.readWorkspaceManifest(workspace);
		assert.strictEqual(manifest?.name, 'Relay');
		assert.ok(files.text(joinPath(workspace, PROJECT_INSTRUCTIONS_PATH))?.includes('Project instructions'));

		files.write(joinPath(workspace, `${PROJECT_KNOWLEDGE_DIR}/notes.md`), '# notes');
		const entries = await service.resolveContextEntries(project);
		assert.deepStrictEqual(entries.map(entry => entry.kind), ['promptFile', 'file']);

		const enabled: string[] = [];
		const withMcp = { ...project, mcpServerIds: ['github'] };
		service.applyMcp(withMcp, {
			setEnabled: (key, state) => {
				assert.strictEqual(state, ContributionEnablementState.EnabledWorkspace);
				enabled.push(key);
			},
		} as IEnablementModel);
		assert.deepStrictEqual(enabled, ['github']);

		const reloaded = store.add(new ProjectsService(storage, files.asService(), {
			files: { models: [] },
		} as unknown as ITextFileService));
		assert.strictEqual(reloaded.getProject(project.id)?.name, 'Relay');
		assert.deepStrictEqual(reloaded.getSessionIds(project.id), ['session-1']);

		const migrated = reloaded.migratePlaceholderGroups([
			{ id: 'g', name: 'Projects', sessionIds: [] },
			{ id: 'c', name: 'Billing', parentId: 'g', sessionIds: ['s9'] },
		]);
		assert.strictEqual(migrated.length, 1);
		assert.strictEqual(reloaded.getProjectOfSession('s9')?.name, 'Billing');
		assert.strictEqual(reloaded.migratePlaceholderGroups([
			{ id: 'g', name: 'Projects', sessionIds: [] },
			{ id: 'c', name: 'Billing', parentId: 'g', sessionIds: ['s9'] },
		]).length, 0);

		const listed = await reloaded.listKnowledgeFiles(project);
		assert.deepStrictEqual(listed.map(uri => uri.path), [`/work/app/${PROJECT_KNOWLEDGE_DIR}/notes.md`]);
		reloaded.removeKnowledge(project.id, URI.file(`/work/app/${PROJECT_KNOWLEDGE_DIR}/notes.md`));
		await new Promise(resolve => setTimeout(resolve, 20));
		assert.deepStrictEqual(await reloaded.listKnowledgeFiles(reloaded.getProject(project.id)!), []);
		assert.strictEqual(files.text(joinPath(workspace, `${PROJECT_KNOWLEDGE_DIR}/notes.md`)), undefined);
	});
});

class MemoryFiles {
	private readonly files = new Map<string, string>();
	private readonly dirs = new Set<string>();

	text(resource: URI): string | undefined {
		return this.files.get(resource.toString());
	}

	write(resource: URI, contents: string): void {
		this.files.set(resource.toString(), contents);
	}

	asService(): IFileService {
		const self = this;
		return {
			async exists(resource: URI): Promise<boolean> {
				const key = resource.toString();
				return self.files.has(key) || self.dirs.has(key);
			},
			async readFile(resource: URI): Promise<{ value: VSBuffer }> {
				const contents = self.files.get(resource.toString());
				if (contents === undefined) {
					throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
				}
				return { value: VSBuffer.fromString(contents) };
			},
			async writeFile(resource: URI, buffer: VSBuffer): Promise<void> {
				self.files.set(resource.toString(), buffer.toString());
			},
			async createFolder(resource: URI): Promise<void> {
				self.dirs.add(resource.toString());
			},
			async stat(resource: URI): Promise<IFileStat> {
				return self.statOf(resource);
			},
			async del(resource: URI): Promise<void> {
				self.files.delete(resource.toString());
			},
			async resolve(resource: URI): Promise<IFileStat> {
				const stat = self.statOf(resource);
				if (!stat.isDirectory) {
					return stat;
				}
				const prefix = `${resource.toString().replace(/\/$/, '')}/`;
				const children: IFileStat[] = [];
				for (const key of self.files.keys()) {
					if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) {
						children.push(self.statOf(URI.parse(key)));
					}
				}
				return { ...stat, children };
			},
		} as unknown as IFileService;
	}

	private statOf(resource: URI): IFileStat {
		const key = resource.toString();
		if (this.dirs.has(key)) {
			return { resource, name: '', isDirectory: true, isSymbolicLink: false, isFile: false, mtime: 0, ctime: 0, size: 0, readonly: false, locked: false, etag: '', children: undefined };
		}
		if (this.files.has(key)) {
			return { resource, name: '', isDirectory: false, isSymbolicLink: false, isFile: true, mtime: 0, ctime: 0, size: this.files.get(key)?.length ?? 0, readonly: false, locked: false, etag: '', children: undefined };
		}
		throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
	}
}
