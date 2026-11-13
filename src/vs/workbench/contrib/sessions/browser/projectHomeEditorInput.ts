/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IModalEditorOptions, IModalEditorOptionsProvider } from '../../../../platform/editor/common/editor.js';
import { EditorInputCapabilities, IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

export class ProjectHomeEditorInput extends EditorInput implements IModalEditorOptionsProvider {
	static readonly ID = 'sessions.input.projectHome';

	constructor(readonly projectId: string, private readonly projectName: string) {
		super();
	}

	override get typeId(): string {
		return ProjectHomeEditorInput.ID;
	}

	override get resource(): URI {
		return URI.from({ scheme: 'vespra-project', path: `/${this.projectId}` });
	}

	override get capabilities(): EditorInputCapabilities {
		return super.capabilities | EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton;
	}

	override getName(): string {
		return this.projectName || localize('project.homeName', "Project");
	}

	override getIcon() {
		return Codicon.project;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return other instanceof ProjectHomeEditorInput && other.projectId === this.projectId;
	}

	getModalEditorOptions(): IModalEditorOptions {
		return { compactHeader: true, canMoveToEditorArea: true };
	}
}
