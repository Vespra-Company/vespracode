/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/projectsSidebar.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { NEW_PROJECT_COMMAND_ID, OPEN_PROJECT_HOME_COMMAND_ID } from './projectCommands.js';
import { IProjectsService } from '../common/projects.js';

export class ProjectsSidebarWidget extends Disposable {
	constructor(
		container: HTMLElement,
		@IProjectsService private readonly projectsService: IProjectsService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		const root = DOM.append(container, DOM.$('.vespra-projects'));
		const renderStore = this._register(new DisposableStore());
		const render = () => {
			renderStore.clear();
			this.render(root, renderStore);
		};
		this._register(this.projectsService.onDidChange(render));
		render();
	}

	private render(root: HTMLElement, renderStore: DisposableStore): void {
		DOM.clearNode(root);
		const header = DOM.append(root, DOM.$('.vespra-projects-header'));
		const label = DOM.append(header, DOM.$('span'));
		label.textContent = localize('projects.header', "Projects");
		const create = DOM.append(header, DOM.$('button.vespra-projects-new')) as HTMLButtonElement;
		create.type = 'button';
		create.title = localize('projects.newTitle', "New Project");
		create.setAttribute('aria-label', localize('projects.newTitle', "New Project"));
		create.textContent = localize('projects.new', "New");
		renderStore.add(DOM.addDisposableListener(create, DOM.EventType.CLICK, () => {
			void this.commandService.executeCommand(NEW_PROJECT_COMMAND_ID);
		}));

		const projects = this.projectsService.getProjects();
		if (projects.length === 0) {
			const empty = DOM.append(root, DOM.$('.vespra-projects-empty'));
			const copy = DOM.append(empty, DOM.$('span'));
			copy.textContent = localize('projects.empty', "Bundle a workspace, instructions, and knowledge for every chat.");
			const cta = DOM.append(empty, DOM.$('button.vespra-projects-empty-cta')) as HTMLButtonElement;
			cta.type = 'button';
			cta.textContent = localize('projects.emptyCta', "Create project");
			renderStore.add(DOM.addDisposableListener(cta, DOM.EventType.CLICK, () => {
				void this.commandService.executeCommand(NEW_PROJECT_COMMAND_ID);
			}));
			return;
		}

		const active = this.projectsService.getActiveProject()?.id;
		for (const project of projects) {
			const row = DOM.append(root, DOM.$('button.vespra-projects-item')) as HTMLButtonElement;
			row.type = 'button';
			row.classList.toggle('active', project.id === active);
			if (project.id === active) {
				row.setAttribute('aria-current', 'true');
			}
			row.title = project.name;
			const icon = DOM.append(row, DOM.$(ThemeIcon.asCSSSelector(Codicon.folder)));
			icon.setAttribute('aria-hidden', 'true');
			const name = DOM.append(row, DOM.$('span.name'));
			name.textContent = project.name;
			const sessionCount = this.projectsService.getSessionIds(project.id).length;
			const count = DOM.append(row, DOM.$('span.count'));
			count.textContent = String(sessionCount);
			count.title = localize('projects.sessionCount', "{0} sessions", sessionCount);
			renderStore.add(DOM.addDisposableListener(row, DOM.EventType.CLICK, () => {
				this.projectsService.setActiveProject(project.id);
				void this.commandService.executeCommand(OPEN_PROJECT_HOME_COMMAND_ID, project.id);
			}));
		}
	}
}
