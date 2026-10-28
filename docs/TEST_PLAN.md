# Test Plan

## Photo uploads

- Text-only report creation remains valid.
- JPEG, PNG, and WebP files are accepted only when the declared MIME type
  matches the decoded image format.
- Malformed files, MIME/signature mismatches, files over 5 MB, and multiple
  uploaded photos are rejected.
- Stored output is JPEG, has no source EXIF metadata, and is no larger than
  1600 pixels on its longest side.
- Report responses do not expose a physical file path.
- Only the report owner or an admin can retrieve its photo.
- A failed database write removes the image that was staged for that report.
