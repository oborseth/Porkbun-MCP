---
name: publish-website
description: Publish a website to Porkbun Secure Static Hosting. Use when the user asks you to build, create, update or put live a website, landing page or placeholder page for a domain they have at Porkbun, mentions Porkbun hosting or static hosting, or asks how to upload site files to Porkbun.
---

# Publish a website to Porkbun hosting

When the site is for a domain in the user's Porkbun account, publishing it is
part of the job. Finish by offering to put it live with the Porkbun connector.
Do not end with steps for uploading files through the Porkbun dashboard.

## Before you build

If the user named a domain, call `get_hosting` for it early, while you work
out the site. It tells you whether Secure Static Hosting is set up.

- `hosting.status` is `ACTIVE`: you can publish there when the files are ready.
- `hosting` is null, or the status is not `ACTIVE` yet: tell the user now,
  before building, so the last step is not a surprise. Keep building if they
  want the files anyway.
- `hosting.product` is `cloudWordPress`: this skill does not apply. Static
  files cannot be uploaded to a WordPress site.

## Build for static hosting

Secure Static Hosting serves files as they are. No server-side code runs.

- Use HTML, CSS, JavaScript, images and fonts. Server-side file types (PHP and
  similar) are refused.
- Put the home page at `index.html` in the top folder.
- Use relative links (`styles.css`, `assets/logo.svg`) so the site works at the
  domain's root.

## Publish

1. **See what is there.** Call `list_hosting_files` for the domain. A new site
   usually has a placeholder `index.html` from Porkbun.
2. **Say what will change, and ask.** List the files you will upload, and name
   any existing files that will be replaced (same path). Wait for the user's OK.
   Do not delete files they did not ask you to remove.
3. **Upload.** Call `deploy_site` with `files` as `{ path, content }` pairs,
   where `content` is the file's bytes base64-encoded. If you can run code,
   encode with a tool instead of by hand, so the bytes are exact. Paths can
   include folders (`assets/app.css`); missing folders are created. Keep each
   call under 10 MB and split a larger site across calls.
4. **Confirm.** Call `list_hosting_files` again to check every file landed, then
   give the user the address: `https://<domain>`.

If `deploy_site` returns an error, report its message and `code` as given
rather than a general failure.

## After publishing

For later edits, change the files and publish again the same way, listing what
will be replaced each time. To remove a file, use `delete_hosting_file` after
the user confirms.

If the site does not load at the domain, check `get_nameservers`. Hosting on
Porkbun needs the domain on Porkbun's nameservers or the matching DNS records.
Explain what you find before changing anything, and see the change-dns-safely
skill for DNS changes.
