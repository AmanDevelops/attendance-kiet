/**
 * Decompresses and decodes a base64url-encoded, deflate-compressed string.
 * Used to receive pre-fetched attendance data from the browser extension.
 */
export async function decompressAndDecode(encoded: string): Promise<string> {
	// Restore standard base64 from base64url
	let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
	while (base64.length % 4) base64 += "=";

	const binary = atob(base64);
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

	const stream = new Blob([bytes])
		.stream()
		.pipeThrough(new DecompressionStream("deflate"));
	const decompressed = await new Response(stream).blob();
	return decompressed.text();
}
