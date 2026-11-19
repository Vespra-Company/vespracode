/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/projectsSidebar.css';
import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { fromNow } from '../../../../base/common/date.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ADD_PROJECT_KNOWLEDGE_COMMAND_ID, DELETE_PROJECT_COMMAND_ID, NEW_CHAT_IN_PROJECT_COMMAND_ID, REMOVE_PROJECT_KNOWLEDGE_COMMAND_ID, RENAME_PROJECT_COMMAND_ID } from './projectCommands.js';
import { ProjectHomeEditorInput } from './projectHomeEditorInput.js';
import { ISessionsService } from './sessionsService.js';
import { IProjectsService, IVespraProject, resolveProjectSessions } from '../common/projects.js';
import { ISessionsManagementService } from '../common/sessionsManagement.js';
import { ISession } from '../../../services/sessions/common/session.js';

interface IProjectListItem {
	readonly title: string;
	readonly detail?: string;
	readonly icon: ThemeIcon;
	readonly action?: { readonly label: string; readonly run: () => void; readonly danger?: boolean };
}

interface IProjectListItemElements {
	readonly title: HTMLElement;
	readonly detail: HTMLElement | undefined;
	readonly action: HTMLButtonElement | undefined;
}

export class ProjectHomeEditor extends EditorPane {
	static readonly ID = 'sessions.editor.projectHome';

	private root: HTMLElement | undefined;
	private readonly renderDisposables = this._register(new DisposableStore());
	private renderGeneration = 0;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IProjectsService private readonly projectsService: IProjectsService,
		@ICommandService private readonly commandService: ICommandService,
		@ISessionsManagementService private readonly sessionsManagementService: ISessionsManagementService,
		@ISessionsService private readonly sessionsService: ISessionsService,
	) {
		super(ProjectHomeEditor.ID, group, telemetryService, themeService, storageService);
		this._register(this.projectsService.onDidChange(() => this.render()));
		this._register(this.sessionsManagementService.onDidChangeSessions(e => {
			if (this.affectsShownProject(e.added) || this.affectsShownProject(e.removed)) {
				this.render();
			}
		}));
	}

	protected override createEditor(parent: HTMLElement): void {
		this.root = dom.append(parent, dom.$('.vespra-project-home'));
	}

	override async setInput(input: ProjectHomeEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (!token.isCancellationRequested) {
			this.render();
		}
	}

	override layout(): void {
		// The home view sizes with its content.
	}

	private affectsShownProject(sessions: readonly ISession[]): boolean {
		const input = this.input;
		if (sessions.length === 0 || !(input instanceof ProjectHomeEditorInput)) {
			return false;
		}
		const members = new Set(this.projectsService.getSessionIds(input.projectId));
		return sessions.some(session => members.has(session.sessionId) || session.previousIdentities?.some(previous => members.has(previous.sessionId)));
	}

	private render(): void {
		if (!this.root) {
			return;
		}
		this.renderGeneration++;
		this.renderDisposables.clear();
		dom.clearNode(this.root);
		const input = this.input;
		if (!(input instanceof ProjectHomeEditorInput)) {
			return;
		}
		const project = this.projectsService.getProject(input.projectId);
		if (!project) {
			const missing = dom.append(this.root, dom.$('.vespra-project-home-missing'));
			missing.textContent = localize('project.missing', "This project is no longer available.");
			return;
		}
		void this.renderProject(project);
	}

	private async renderProject(project: IVespraProject): Promise<void> {
		if (!this.root) {
			return;
		}
		const generation = this.renderGeneration;
		const knowledge = await this.projectsService.listKnowledgeFiles(project);
		// A newer render may have started while knowledge files were listed.
		if (!this.root || this.renderDisposables.isDisposed || generation !== this.renderGeneration) {
			return;
		}

		const inner = dom.append(this.root, dom.$('.vespra-project-home-inner'));
		const header = dom.append(inner, dom.$('.vespra-project-home-header'));
		const titleRow = dom.append(header, dom.$('.vespra-project-home-title-row'));
		const heading = dom.append(titleRow, dom.$('h1'));
		const title = dom.append(heading, dom.$('span.name'));
		title.textContent = project.name;
		title.title = project.name;

		const meta = dom.append(titleRow, dom.$('.vespra-project-home-meta'));
		this.renderAction(meta, localize('project.rename', "Rename"), () => {
			void this.commandService.executeCommand(RENAME_PROJECT_COMMAND_ID, project.id);
		});
		this.renderAction(meta, localize('project.delete', "Delete"), () => {
			void this.commandService.executeCommand(DELETE_PROJECT_COMMAND_ID, project.id);
		}, true);

		const summary = dom.append(header, dom.$('p.vespra-project-home-lede'));
		summary.textContent = localize('project.summary', "Sessions in this project share its workspace, instructions, and knowledge.");

		const actions = dom.append(inner, dom.$('.actions'));
		const chat = this.renderDisposables.add(new Button(actions, defaultButtonStyles));
		chat.label = localize('project.newChat', "New chat in this project");
		this.renderDisposables.add(chat.onDidClick(() => {
			void this.commandService.executeCommand(NEW_CHAT_IN_PROJECT_COMMAND_ID, project.id);
		}));
		const customizations = this.renderDisposables.add(new Button(actions, { ...defaultButtonStyles, secondary: true }));
		customizations.label = localize('project.customizations', "Open Customizations");
		this.renderDisposables.add(customizations.onDidClick(() => {
			void this.commandService.executeCommand('aiCustomization.openManagementEditor');
		}));

		const sections = dom.append(inner, dom.$('.vespra-project-home-sections'));
		this.renderItems(
			sections,
			localize('project.workspace', "Workspace"),
			Codicon.folderOpened,
			project.workspaceUris.map(uri => ({
				title: basename(uri) || uri.toString(),
				detail: this.pathDetail(uri),
				icon: Codicon.folder,
			})),
			{
				empty: localize('project.workspaceEmpty', "No folder linked yet. Create a project with a folder to pin the workspace."),
			},
		);

		const instructionsItems: IProjectListItem[] = project.instructionsUri
			? [{
				title: basename(project.instructionsUri),
				detail: this.pathDetail(project.instructionsUri),
				icon: Codicon.markdown,
			}]
			: [{
				title: localize('project.instructionsDefault', "AGENTS.md or .vespra/INSTRUCTIONS.md"),
				detail: localize('project.instructionsHint', "Created with the project workspace"),
				icon: Codicon.markdown,
			}];
		this.renderItems(sections, localize('project.instructions', "Instructions"), Codicon.book, instructionsItems);

		this.renderKnowledge(sections, project, knowledge);

		this.renderSessions(sections, project);

		if (project.mcpServerIds.length > 0) {
			this.renderItems(sections, localize('project.mcp', "MCP"), Codicon.server, project.mcpServerIds.map(id => ({
				title: id,
				icon: Codicon.serverProcess,
			})));
		}
	}

	private renderKnowledge(container: HTMLElement, project: IVespraProject, files: readonly URI[]): void {
		const section = dom.append(container, dom.$('section.vespra-project-section'));
		const heading = dom.append(section, dom.$('h2'));
		dom.append(heading, dom.$(ThemeIcon.asCSSSelector(Codicon.library)));
		dom.append(heading, dom.$('span')).textContent = localize('project.knowledge', "Knowledge");
		this.renderAction(heading, localize('project.addKnowledge', "Add"), () => {
			void this.commandService.executeCommand(ADD_PROJECT_KNOWLEDGE_COMMAND_ID, project.id);
		});

		if (files.length === 0) {
			const empty = dom.append(section, dom.$('p.empty'));
			empty.textContent = localize('project.knowledgeEmpty', "Add notes or docs every chat in this project can use.");
			return;
		}

		const list = dom.append(section, dom.$('ul'));
		for (const file of files) {
			this.renderItem(list, {
				title: basename(file) || file.toString(),
				icon: Codicon.file,
				action: {
					label: localize('project.removeKnowledge', "Remove"),
					run: () => void this.commandService.executeCommand(REMOVE_PROJECT_KNOWLEDGE_COMMAND_ID, project.id, file.toString()),
				},
			});
		}
	}

	private renderSessions(container: HTMLElement, project: IVespraProject): void {
		const { sessions, unresolvedIds } = resolveProjectSessions(this.projectsService.getSessionIds(project.id), this.sessionsManagementService.getSessions());
		if (sessions.length === 0 && unresolvedIds.length === 0) {
			this.renderItems(container, localize('project.sessions', "Sessions"), Codicon.commentDiscussion, [], {
				empty: localize('project.sessionsEmpty', "No chats in this project yet."),
				actionLabel: localize('project.sessionsEmptyCta', "Start a chat"),
				action: () => void this.commandService.executeCommand(NEW_CHAT_IN_PROJECT_COMMAND_ID, project.id),
			});
			return;
		}

		const section = this.renderSection(container, localize('project.sessions', "Sessions"), Codicon.commentDiscussion);
		if (sessions.length > 0) {
			const list = dom.append(section, dom.$('ul'));
			for (const session of sessions) {
				const elements = this.renderItem(list, {
					title: '',
					detail: '',
					icon: session.icon,
					action: {
						label: localize('project.openSession', "Open"),
						run: () => void this.sessionsService.openSession(session.resource),
					},
				});
				this.renderDisposables.add(autorun(reader => {
					const title = session.title.read(reader) || localize('project.untitledSession', "Untitled Session");
					const detail = session.isArchived.read(reader)
						? localize('project.sessionArchived', "Archived")
						: fromNow(session.updatedAt.read(reader), true);
					elements.title.textContent = title;
					elements.title.title = `${title} — ${detail}`;
					if (elements.detail) {
						elements.detail.textContent = detail;
						elements.detail.title = detail;
					}
					elements.action?.setAttribute('aria-label', localize('project.openSessionAria', "Open {0}", title));
				}));
			}
		}
		if (unresolvedIds.length > 0) {
			const unavailable = dom.append(section, dom.$('p.empty'));
			unavailable.textContent = unresolvedIds.length === 1
				? localize('project.sessionUnavailable', "1 session isn't available right now.")
				: localize('project.sessionsUnavailable', "{0} sessions aren't available right now.", unresolvedIds.length);
		}
	}

	private renderSection(container: HTMLElement, heading: string, icon: ThemeIcon): HTMLElement {
		const section = dom.append(container, dom.$('section.vespra-project-section'));
		const title = dom.append(section, dom.$('h2'));
		dom.append(title, dom.$(ThemeIcon.asCSSSelector(icon)));
		dom.append(title, dom.$('span')).textContent = heading;
		return section;
	}

	private renderItems(
		container: HTMLElement,
		heading: string,
		icon: ThemeIcon,
		items: readonly IProjectListItem[],
		emptyState?: { readonly empty: string; readonly actionLabel?: string; readonly action?: () => void },
	): void {
		const section = this.renderSection(container, heading, icon);

		if (items.length === 0) {
			if (emptyState?.action && emptyState.actionLabel) {
				const row = dom.append(section, dom.$('.empty-row'));
				dom.append(row, dom.$('p.empty')).textContent = emptyState.empty;
				this.renderAction(row, emptyState.actionLabel, emptyState.action);
			} else {
				const empty = dom.append(section, dom.$('p.empty'));
				empty.textContent = emptyState?.empty ?? localize('project.none', "None yet");
			}
			return;
		}

		const list = dom.append(section, dom.$('ul'));
		for (const item of items) {
			this.renderItem(list, item);
		}
	}

	private renderItem(list: HTMLElement, item: IProjectListItem): IProjectListItemElements {
		const row = dom.append(list, dom.$('li'));
		const icon = dom.append(row, dom.$(`${ThemeIcon.asCSSSelector(item.icon)}.item-icon`));
		icon.setAttribute('aria-hidden', 'true');
		const body = dom.append(row, dom.$('.item-body'));
		const title = dom.append(body, dom.$('span.item-title'));
		title.textContent = item.title;
		title.title = item.detail ? `${item.title} — ${item.detail}` : item.title;
		let detail: HTMLElement | undefined;
		if (item.detail !== undefined) {
			detail = dom.append(body, dom.$('span.item-detail'));
			detail.textContent = item.detail;
			detail.title = item.detail;
		}
		const action = item.action ? this.renderAction(row, item.action.label, item.action.run, item.action.danger) : undefined;
		return { title, detail, action };
	}

	private renderAction(container: HTMLElement, label: string, run: () => void, danger = false): HTMLButtonElement {
		const button = dom.append(container, dom.$('button.vespra-project-action')) as HTMLButtonElement;
		button.type = 'button';
		button.textContent = label;
		if (danger) {
			button.classList.add('danger');
		}
		this.renderDisposables.add(dom.addDisposableListener(button, dom.EventType.CLICK, run));
		return button;
	}

	private pathDetail(uri: URI): string | undefined {
		const full = uri.fsPath || uri.toString();
		const name = basename(uri);
		if (!name || full === name) {
			return undefined;
		}
		return full;
	}
}
