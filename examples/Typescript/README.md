# ChurchTools API Client Example

A simple TypeScript example demonstrating how to use the ChurchTools API client
to interact with your ChurchTools instance.

## Prerequisites

- Node.js (version 16 or higher)
- Access to a ChurchTools instance
- ChurchTools API credentials (username/password or Login token)

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Your Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your ChurchTools details:

```env
BASE_URL="https://your-church.church.tools"
USERNAME="your-username"
PASSWORD="your-password"
TOKEN=""
```

**Note:** You can use either username/password OR a personal access token. If
you provide a TOKEN, it will be used instead of username/password.

### 3. Generate API Types (Optional)

Replace `<YOUR_BASE_URL>` in package.json with your actual ChurchTools URL, then
run:

```bash
npm run generate-types
```

This creates TypeScript definitions for your ChurchTools API.

### 4. Run the Example

For development (runs TypeScript directly):

```bash
npm run dev
```

For production (compiles and runs):

```bash
npm run build
npm start
```

## What This Example Does

The example connects to your ChurchTools instance and:

1. Authenticates using your credentials
2. Calls the `whoami` endpoint
3. Displays your first name

## Project Structure

```
├── src/
│   ├── index.ts              # Main application entry point
│   ├── clients/
│   │   └── churchtools-api.ts # ChurchTools API client wrapper
│   ├── config/
│   │   └── index.ts          # Configuration management
│   └── types/
│       └── churchtools-api.ts # Generated API types
├── .env                      # Your environment variables (create this)
├── .env.example              # Environment template
└── package.json              # Project configuration
```

## Available Methods

The `ChurchToolsApiClient` class provides:

- `whoAmI()` - Get current user information
- `getAppointments()` - Get calendar appointments
- `getCalendarAppointmentsByCalendarId(id)` - Get appointments for specific
  calendar

## Customizing the Example

### Adding New API Calls

1. Add methods to
   [src/clients/churchtools-api.ts](src/clients/churchtools-api.ts)
2. Use them in [src/index.ts](src/index.ts)

For more information about the ChurchTools API, visit the
[ChurchTools API documentation](https://api.church.tools/).
