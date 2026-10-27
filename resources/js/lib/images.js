/**
 * The longest side, in pixels, a photo is uploaded at: sharp enough to read
 * a cheque or a scanned page, a fraction of a phone photo's size.
 */
const MAX_SIDE = 2000;

const SHRINKABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * A smaller copy of a photo for upload: scaled so its longest side is at
 * most MAX_SIDE and saved as a JPEG, so a 4 MB phone photo goes up as a few
 * hundred KB. PDFs and other files, photos the browser cannot read, and
 * photos that would not get smaller come back unchanged.
 *
 * @param {File|null} file
 * @return {Promise<File|null>}
 */
export async function shrinkImage(file) {
    if (!file || !SHRINKABLE_TYPES.includes(file.type)) {
        return file;
    }

    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);

        const context = canvas.getContext('2d');
        // JPEG has no transparency, so see-through parts of a PNG become white rather than black.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));

        if (!blob || blob.size >= file.size) {
            return file;
        }

        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
    } catch {
        return file;
    }
}
