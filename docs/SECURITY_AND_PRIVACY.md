# Security and Privacy

## Photo uploads (Phase 5)

- Report creation accepts at most one optional photo, up to 5 MB.
- The API checks the declared MIME type against the format decoded by Sharp and
  accepts only JPEG, PNG, and WebP input. Unsupported or malformed images are
  rejected.
- Accepted images are orientation-corrected, resized to at most 1600 pixels on
  the longest side, re-encoded as JPEG, and stripped of source metadata.
- The API creates a random storage key. It does not use the submitted filename
  and does not return a filesystem path.
- Development photos stay in the private `UPLOAD_DIR`. The directory is not
  served as static content. Photo downloads use the authenticated report photo
  endpoint and require the report owner or an admin.
- If database persistence fails after an image is written, the API removes the
  unlinked image.
- Local disk may be ephemeral in a deployment. Persistent production uploads
  require a private object-storage adapter; the local adapter is for
  development and testing.

## General rules

- Keep `.env` and private uploads out of Git.
- Do not log passwords, tokens, image bytes, or complete private request bodies.
- The prototype does not send reports to a municipal authority.
