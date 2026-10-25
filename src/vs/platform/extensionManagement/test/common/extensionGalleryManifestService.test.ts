/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IProductService } from '../../../product/common/productService.js';
import { ExtensionGalleryManifestStatus, ExtensionGalleryResourceType, getExtensionGalleryManifestResourceUri } from '../../common/extensionGalleryManifest.js';
import { ExtensionGalleryManifestService } from '../../common/extensionGalleryManifestService.js';

suite('ExtensionGalleryManifestService', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function aProductService(extensionsGallery?: Partial<NonNullable<IProductService['extensionsGallery']>>): IProductService {
		return { _serviceBrand: undefined, extensionsGallery } as unknown as IProductService;
	}

	test('reports unavailable without a gallery', async () => {
		const testObject = disposables.add(new ExtensionGalleryManifestService(aProductService()));
		assert.strictEqual(testObject.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Unavailable);
		assert.strictEqual(await testObject.getExtensionGalleryManifest(), null);
	});

	test('builds resources from the gallery configuration', async () => {
		const testObject = disposables.add(new ExtensionGalleryManifestService(aProductService({
			serviceUrl: 'https://open-vsx.org/vscode/gallery',
			itemUrl: 'https://open-vsx.org/vscode/item',
			publisherUrl: 'https://open-vsx.org/namespace',
			resourceUrlTemplate: 'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
		})));

		assert.strictEqual(testObject.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Available);
		const manifest = await testObject.getExtensionGalleryManifest();
		assert.ok(manifest);
		assert.deepStrictEqual([
			getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionQueryService),
			getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionLatestVersionUri),
			getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionDetailsViewUri),
			getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.PublisherViewUri),
			getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionResourceUri),
		], [
			'https://open-vsx.org/vscode/gallery/extensionquery',
			'https://open-vsx.org/vscode/gallery/vscode/{publisher}/{name}/latest',
			'https://open-vsx.org/vscode/item?itemName={publisher}.{name}',
			'https://open-vsx.org/namespace/{publisher}',
			'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
		]);
	});

	test('requires signatures unless the gallery opts out of verification', async () => {
		const signedManifest = await disposables.add(new ExtensionGalleryManifestService(aProductService({ serviceUrl: 'https://gallery' }))).getExtensionGalleryManifest();
		const explicitManifest = await disposables.add(new ExtensionGalleryManifestService(aProductService({ serviceUrl: 'https://gallery', verifySignature: true }))).getExtensionGalleryManifest();
		const unverifiedManifest = await disposables.add(new ExtensionGalleryManifestService(aProductService({ serviceUrl: 'https://gallery', verifySignature: false }))).getExtensionGalleryManifest();

		assert.deepStrictEqual([
			signedManifest?.capabilities.signing?.allPublicRepositorySigned,
			explicitManifest?.capabilities.signing?.allPublicRepositorySigned,
			unverifiedManifest?.capabilities.signing?.allPublicRepositorySigned,
		], [true, true, false]);
	});
});
