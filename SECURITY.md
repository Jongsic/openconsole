# Security Policy

## Security model

OpenConsole is a **browser-only** application. There is no backend server and no
telemetry:

- All S3 requests are made **directly from your browser** to the endpoint you configure.
- Connection settings (endpoint, region, **access key ID and secret access key**) are stored
  **in your browser's `localStorage` in plain text**. They never leave your browser except as
  signed requests to the S3 endpoint you specify.
- Nothing is sent to the project authors or any third party.

## Your responsibilities

You are responsible for the credentials and backends you use with this tool. In particular:

- Use **least-privilege** credentials. Do not paste long-lived, broadly-scoped production keys.
- Prefer temporary or scoped keys, especially against real AWS.
- Remember that anyone with access to your browser profile can read the stored credentials.
- Configuring CORS on your backend to allow this app's origin is your decision and your
  responsibility.
- Clear the settings (the **Reset** button in the connection dialog) when done on a shared
  machine.

## Disclaimer of liability

This software is released into the public domain under **The Unlicense** and is provided
**"AS IS", without warranty of any kind**, express or implied. To the maximum extent permitted
by law, the authors and contributors are **not liable** for any claim, damages, loss, cost, or
other liability — including but not limited to credential exposure, unauthorized access, data
loss, or cloud-provider charges — arising from the use of this software. **You use it entirely
at your own risk**, and you are solely responsible for securing your credentials, data, and
infrastructure. See the [LICENSE](LICENSE) file.

## Reporting a vulnerability

If you discover a security issue in the OpenConsole code itself, please report it privately via
GitHub's **"Report a vulnerability"** (Security advisories) on the repository, rather than
opening a public issue. We will review and respond as time permits. Only the latest version on
the default branch is supported.
