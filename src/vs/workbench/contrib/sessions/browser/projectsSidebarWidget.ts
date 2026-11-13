/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/projectsSidebar.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
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
		create.textContent = localize('projects.new', "New");
		renderStore.add(DOM.addDisposableListener(create, DOM.EventType.CLICK, () => {
			void this.commandService.executeCommand(NEW_PROJECT_COMMAND_ID);
		}));

		const projects = this.projectsService.getProjects();
		if (projects.length === 0) {
			const empty = DOM.append(root, DOM.$('.vespra-projects-empty'));
			empty.textContent = localize('projects.empty', "A project keeps the workspace, instructions, and knowledge every chat joins.");
			return;
		}

		const active = this.projectsService.getActiveProject()?.id;
		for (const project of projects) {
			const row = DOM.append(root, DOM.$('button.vespra-projects-item'));
			row.classList.toggle('active', project.id === active);
			const name = DOM.append(row, DOM.$('span'));
			name.textContent = project.name;
			const count = DOM.append(row, DOM.$('span.count'));
			count.textContent = String(this.projectsService.getSessionIds(project.id).length);
			renderStore.add(DOM.addDisposableListener(row, DOM.EventType.CLICK, () => {
				this.projectsService.setActiveProject(project.id);
				void this.commandService.executeCommand(OPEN_PROJECT_HOME_COMMAND_ID, project.id);
			}));
		}
	}
}
