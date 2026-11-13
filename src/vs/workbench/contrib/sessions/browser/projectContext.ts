/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IEnablementModel, ContributionEnablementState } from '../../chat/common/enablement.js';
import { IChatRequestVariableEntry, PromptFileVariableKind, toFileVariableEntry, toPromptFileVariableEntry } from '../../chat/common/attachments/chatVariableEntries.js';
import { IVespraProject, instructionCandidates, knowledgeCandidates } from '../common/projects.js';

export interface IResolvedProjectContext {
	readonly instructions: readonly URI[];
	readonly knowledge: readonly URI[];
}

export function buildProjectContextEntries(resolved: IResolvedProjectContext): IChatRequestVariableEntry[] {
	const entries: IChatRequestVariableEntry[] = [];
	for (const uri of resolved.instructions) {
		entries.push(toPromptFileVariableEntry(uri, PromptFileVariableKind.Instruction, 'Vespra Project', true));
	}
	for (const uri of resolved.knowledge) {
		entries.push(toFileVariableEntry(uri));
	}
	return entries;
}

export function projectContextCandidates(project: IVespraProject): IResolvedProjectContext {
	return {
		instructions: instructionCandidates(project),
		knowledge: knowledgeCandidates(project),
	};
}

/** Enables the project's MCP servers for the current workspace. Unknown ids are ignored by callers. */
export function applyProjectMcpEnablement(model: IEnablementModel, project: IVespraProject): void {
	for (const serverId of project.mcpServerIds) {
		if (model.canSetEnabled && !model.canSetEnabled(serverId, ContributionEnablementState.EnabledWorkspace)) {
			continue;
		}
		model.setEnabled(serverId, ContributionEnablementState.EnabledWorkspace);
	}
}
