/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/projectsSidebar.css';
import * as dom from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { NEW_CHAT_IN_PROJECT_COMMAND_ID } from './projectCommands.js';
import { ProjectHomeEditorInput } from './projectHomeEditorInput.js';
import { IProjectsService } from '../common/projects.js';

export class ProjectHomeEditor extends EditorPane {
	static readonly ID = 'sessions.editor.projectHome';

	private root: HTMLElement | undefined;
	private readonly renderDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IProjectsService private readonly projectsService: IProjectsService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(ProjectHomeEditor.ID, group, telemetryService, themeService, storageService);
		this._register(this.projectsService.onDidChange(() => this.render()));
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

	private render(): void {
		if (!this.root) {
			return;
		}
		this.renderDisposables.clear();
		dom.clearNode(this.root);
		const input = this.input;
		if (!(input instanceof ProjectHomeEditorInput)) {
			return;
		}
		const project = this.projectsService.getProject(input.projectId);
		if (!project) {
			this.root.textContent = localize('project.missing', "This project is no longer available.");
			return;
		}

		const title = dom.append(this.root, dom.$('h1'));
		title.textContent = project.name;
		const summary = dom.append(this.root, dom.$('p'));
		summary.textContent = localize('project.summary', "Sessions in this project share its workspace, instructions, and knowledge.");

		const actions = dom.append(this.root, dom.$('.actions'));
		const chat = dom.append(actions, dom.$('a.monaco-button.monaco-text-button'));
		chat.textContent = localize('project.newChat', "New chat in this project");
		chat.tabIndex = 0;
		this.renderDisposables.add(dom.addDisposableListener(chat, dom.EventType.CLICK, () => {
			void this.commandService.executeCommand(NEW_CHAT_IN_PROJECT_COMMAND_ID, project.id);
		}));
		const customizations = dom.append(actions, dom.$('a.monaco-button.monaco-text-button'));
		customizations.textContent = localize('project.customizations', "Open Customizations");
		customizations.tabIndex = 0;
		this.renderDisposables.add(dom.addDisposableListener(customizations, dom.EventType.CLICK, () => {
			void this.commandService.executeCommand('aiCustomization.openManagementEditor');
		}));

		this.renderList(localize('project.workspace', "Workspace"), project.workspaceUris.map(uri => uri.fsPath || uri.toString()));
		this.renderList(localize('project.instructions', "Instructions"), [project.instructionsUri?.fsPath || project.instructionsUri?.toString() || localize('project.instructionsDefault', "AGENTS.md or .vespra/INSTRUCTIONS.md")]);
		this.renderList(localize('project.knowledge', "Knowledge"), project.knowledgeUris.map(uri => uri.fsPath || uri.toString()));
		this.renderList(localize('project.sessions', "Sessions"), this.projectsService.getSessionIds(project.id));
		if (project.mcpServerIds.length > 0) {
			this.renderList(localize('project.mcp', "MCP"), project.mcpServerIds);
		}
	}

	private renderList(heading: string, items: readonly string[]): void {
		if (!this.root) {
			return;
		}
		const section = dom.append(this.root, dom.$('section'));
		const title = dom.append(section, dom.$('h2'));
		title.textContent = heading;
		if (items.length === 0) {
			const empty = dom.append(section, dom.$('p'));
			empty.textContent = localize('project.none', "None yet");
			return;
		}
		const list = dom.append(section, dom.$('ul'));
		for (const item of items) {
			const row = dom.append(list, dom.$('li'));
			row.textContent = item;
		}
	}
}
