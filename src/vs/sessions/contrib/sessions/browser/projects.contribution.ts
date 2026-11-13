/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../../workbench/browser/editor.js';
import { EditorExtensions } from '../../../../workbench/common/editor.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { Menus } from '../../../../workbench/contrib/sessions/browser/menus.js';
import { ISession } from '../../../../workbench/services/sessions/common/session.js';
import { IMcpService } from '../../../../workbench/contrib/mcp/common/mcpTypes.js';
import { ISessionGroupsService } from '../../../../workbench/contrib/sessions/browser/sessionGroupsService.js';
import { ADD_PROJECT_KNOWLEDGE_COMMAND_ID, DELETE_PROJECT_COMMAND_ID, MOVE_SESSION_TO_PROJECT_COMMAND_ID, NEW_CHAT_IN_PROJECT_COMMAND_ID, NEW_PROJECT_COMMAND_ID, OPEN_PROJECT_HOME_COMMAND_ID, REMOVE_PROJECT_KNOWLEDGE_COMMAND_ID, RENAME_PROJECT_COMMAND_ID } from '../../../../workbench/contrib/sessions/browser/projectCommands.js';
import { ProjectHomeEditor } from '../../../../workbench/contrib/sessions/browser/projectHomeEditor.js';
import { isProjectHomeEditorInput, ProjectHomeEditorInput } from '../../../../workbench/contrib/sessions/browser/projectHomeEditorInput.js';
import { ISessionsService } from '../../../../workbench/contrib/sessions/browser/sessionsService.js';
import { SessionsCategories } from '../../../../workbench/contrib/sessions/common/categories.js';
import { IProjectsService } from '../../../../workbench/contrib/sessions/common/projects.js';
import { ISessionsManagementService } from '../../../../workbench/contrib/sessions/common/sessionsManagement.js';
import { ITextFileService } from '../../../../workbench/services/textfile/common/textfiles.js';
import { URI } from '../../../../base/common/uri.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(ProjectHomeEditor, ProjectHomeEditor.ID, localize('project.editorLabel', "Project")),
	[new SyncDescriptor(ProjectHomeEditorInput)],
);

class ProjectsMigrationContribution {
	static readonly ID = 'sessions.projects.migration';

	constructor(
		@IProjectsService projectsService: IProjectsService,
		@ISessionGroupsService groupsService: ISessionGroupsService,
	) {
		projectsService.migratePlaceholderGroups(groupsService.getGroups().map(group => ({
			id: group.id,
			name: group.name,
			parentId: group.parentId,
			sessionIds: groupsService.getSessionIdsInGroup(group.id),
		})));
	}
}

registerWorkbenchContribution2(ProjectsMigrationContribution.ID, ProjectsMigrationContribution, WorkbenchPhase.AfterRestored);

async function openProjectHome(projects: IProjectsService, editorService: IEditorService, projectId: string): Promise<void> {
	const project = projects.getProject(projectId);
	if (!project) {
		return;
	}
	projects.setActiveProject(project.id);
	await editorService.openEditor(new ProjectHomeEditorInput(project.id, project.name), { pinned: true });
}

registerAction2(class NewProjectAction extends Action2 {
	constructor() {
		super({
			id: NEW_PROJECT_COMMAND_ID,
			title: localize2('projects.new', "New Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const fileDialog = accessor.get(IFileDialogService);
		const projects = accessor.get(IProjectsService);
		const editorService = accessor.get(IEditorService);
		const name = await quickInput.input({
			prompt: localize('projects.namePrompt', "Name this project"),
			placeHolder: localize('projects.namePlaceholder', "Project name"),
			value: localize('projects.defaultName', "Project"),
		});
		if (name === undefined) {
			return;
		}
		const folder = await fileDialog.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			title: localize('projects.pickFolder', "Choose the project folder"),
			openLabel: localize('projects.useFolder', "Use Folder"),
		});
		const project = await projects.createProject(name, folder?.[0]);
		await openProjectHome(projects, editorService, project.id);
	}
});

registerAction2(class OpenProjectHomeAction extends Action2 {
	constructor() {
		super({
			id: OPEN_PROJECT_HOME_COMMAND_ID,
			title: localize2('projects.openHome', "Open Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, projectId?: string): Promise<void> {
		const projects = accessor.get(IProjectsService);
		const editorService = accessor.get(IEditorService);
		const quickInput = accessor.get(IQuickInputService);
		const id = projectId ?? projects.getActiveProject()?.id ?? await pickProject(quickInput, projects);
		if (id) {
			await openProjectHome(projects, editorService, id);
		}
	}
});

registerAction2(class NewChatInProjectAction extends Action2 {
	constructor() {
		super({
			id: NEW_CHAT_IN_PROJECT_COMMAND_ID,
			title: localize2('projects.newChat', "New Chat in Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, projectId?: string): Promise<void> {
		const projects = accessor.get(IProjectsService);
		const sessions = accessor.get(ISessionsService);
		const quickInput = accessor.get(IQuickInputService);
		let enablement: IMcpService['enablementModel'] | undefined;
		try {
			enablement = accessor.get(IMcpService).enablementModel;
		} catch {
			enablement = undefined;
		}
		const id = projectId ?? projects.getActiveProject()?.id ?? await pickProject(quickInput, projects);
		const project = id ? projects.getProject(id) : undefined;
		if (!project) {
			return;
		}
		projects.setActiveProject(project.id);
		if (enablement) {
			projects.applyMcp(project, enablement);
		}
		const opened = await sessions.openNewSession({ folderUri: project.workspaceUris[0] });
		if (opened.session) {
			projects.assignSession(opened.session.sessionId, project.id);
		}
	}
});

registerAction2(class MoveSessionToProjectAction extends Action2 {
	constructor() {
		super({
			id: MOVE_SESSION_TO_PROJECT_COMMAND_ID,
			title: localize2('projects.moveSession', "Move Session to Project"),
			category: SessionsCategories.Sessions,
			f1: true,
			menu: [{
				id: Menus.SessionItemContextMenu,
				group: '2_organize',
				order: 20,
			}],
		});
	}

	override async run(accessor: ServicesAccessor, sessionOrId?: string | ISession | readonly ISession[]): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const projects = accessor.get(IProjectsService);
		const targetSessions = sessionIdsFrom(sessionOrId);
		if (targetSessions.length === 0) {
			const sessions = accessor.get(ISessionsManagementService).getSessions();
			const picked = await quickInput.pick(sessions.map(session => ({
				label: session.title.get() || session.sessionId,
				id: session.sessionId,
			})), { placeHolder: localize('projects.pickSession', "Session to move") });
			if (picked) {
				targetSessions.push(picked.id);
			}
		}
		if (targetSessions.length === 0) {
			return;
		}
		const projectPick = await quickInput.pick([
			...projects.getProjects().map(project => ({ label: project.name, id: project.id })),
			{ label: localize('projects.remove', "Remove from project"), id: '' },
		], { placeHolder: localize('projects.pickProject', "Project") });
		if (!projectPick) {
			return;
		}
		const projectId = projectPick.id.length > 0 ? projectPick.id : undefined;
		for (const sessionId of targetSessions) {
			projects.assignSession(sessionId, projectId);
		}
	}
});

registerAction2(class RenameProjectAction extends Action2 {
	constructor() {
		super({
			id: RENAME_PROJECT_COMMAND_ID,
			title: localize2('projects.rename', "Rename Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, projectId?: string): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const projects = accessor.get(IProjectsService);
		const id = projectId ?? projects.getActiveProject()?.id;
		const project = id ? projects.getProject(id) : undefined;
		if (!project) {
			return;
		}
		const name = await quickInput.input({
			prompt: localize('projects.renamePrompt', "Rename this project"),
			value: project.name,
		});
		if (name !== undefined) {
			projects.renameProject(project.id, name);
		}
	}
});

registerAction2(class DeleteProjectAction extends Action2 {
	constructor() {
		super({
			id: DELETE_PROJECT_COMMAND_ID,
			title: localize2('projects.delete', "Delete Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, projectId?: string): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const projects = accessor.get(IProjectsService);
		const editorService = accessor.get(IEditorService);
		const id = projectId ?? projects.getActiveProject()?.id;
		const project = id ? projects.getProject(id) : undefined;
		if (!project) {
			return;
		}
		const sessions = projects.getSessionIds(project.id).length;
		const label = sessions > 0
			? localize('projects.deleteSessions', "Delete {0} and its {1} sessions?", project.name, sessions)
			: localize('projects.deleteProject', "Delete {0}?", project.name);
		const picked = await quickInput.pick([
			{ label, id: 'delete' },
			{ label: localize('projects.keep', "Keep project"), id: 'keep' },
		], { placeHolder: localize('projects.deletePrompt', "The .vespra folder in the workspace is left on disk.") });
		if (picked?.id !== 'delete') {
			return;
		}
		const pane = editorService.activeEditorPane;
		if (pane && isProjectHomeEditorInput(pane.input) && pane.input.projectId === project.id) {
			await editorService.closeEditor({ editor: pane.input, groupId: pane.group.id });
		}
		projects.deleteProject(project.id);
	}
});

registerAction2(class AddProjectKnowledgeAction extends Action2 {
	constructor() {
		super({
			id: ADD_PROJECT_KNOWLEDGE_COMMAND_ID,
			title: localize2('projects.addKnowledge', "Add Knowledge to Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, projectId?: string): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const projects = accessor.get(IProjectsService);
		const textFiles = accessor.get(ITextFileService);
		const id = projectId ?? projects.getActiveProject()?.id ?? await pickProject(quickInput, projects);
		const project = id ? projects.getProject(id) : undefined;
		if (!project || !project.workspaceUris.length) {
			return;
		}
		const root = project.workspaceUris[0];
		const candidates: { label: string; id: string }[] = [];
		for (const model of textFiles.files.models.filter(model => model.isDirty() && model.resource.scheme === root.scheme && model.resource.path.startsWith(`${root.path}/`))) {
			candidates.push({ label: localize('projects.unsaved', "Unsaved: {0}", model.resource.path.slice(root.path.length + 1)), id: `dirty:${model.resource.toString()}` });
		}
		const picked = await quickInput.pick([
			...candidates,
			{ label: localize('projects.openFile', "Open file..."), id: 'open' },
		], { placeHolder: localize('projects.knowledgePrompt', "Add a file the model always has") });
		if (!picked) {
			return;
		}
		if (picked.id.startsWith('dirty:')) {
			const uri = URI.parse(picked.id.slice('dirty:'.length));
			await textFiles.save(uri);
		}
		await projects.addKnowledge(project.id);
	}
});

registerAction2(class RemoveProjectKnowledgeAction extends Action2 {
	constructor() {
		super({
			id: REMOVE_PROJECT_KNOWLEDGE_COMMAND_ID,
			title: localize2('projects.removeKnowledge', "Remove Knowledge from Project"),
			category: SessionsCategories.Sessions,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, projectId?: string, uri?: string): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const projects = accessor.get(IProjectsService);
		const id = projectId ?? projects.getActiveProject()?.id ?? await pickProject(quickInput, projects);
		const project = id ? projects.getProject(id) : undefined;
		if (!project) {
			return;
		}
		let target = typeof uri === 'string' ? uri : undefined;
		if (!target) {
			const files = await projects.listKnowledgeFiles(project);
			const picked = await quickInput.pick(files.map(file => ({
				label: file.path.split('/').pop() ?? file.toString(),
				id: file.toString(),
			})), { placeHolder: localize('projects.removeKnowledgePrompt', "Knowledge file to remove") });
			target = picked?.id;
		}
		if (target) {
			projects.removeKnowledge(project.id, URI.parse(target));
		}
	}
});

function sessionIdsFrom(value: string | ISession | readonly ISession[] | undefined): string[] {
	if (typeof value === 'string') {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.map(session => session.sessionId);
	}
	if (value && typeof value === 'object' && 'sessionId' in value && typeof value.sessionId === 'string') {
		return [value.sessionId];
	}
	return [];
}

async function pickProject(quickInput: IQuickInputService, projectsService: IProjectsService): Promise<string | undefined> {
	const projects = projectsService.getProjects();
	if (projects.length === 0) {
		return undefined;
	}
	const picked = await quickInput.pick(projects.map(project => ({
		label: project.name,
		id: project.id,
	})), { placeHolder: localize('projects.pickProject', "Project") });
	return picked?.id;
}
