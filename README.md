# Full-Stack Real-Time Chat Application

A Slack-like real-time chat and collaboration web application built with modern web technologies.

## Technology Stack

- **Frontend:** React, Vite, Tailwind CSS v4, Socket.io-client
- **Backend:** Node.js, Express, Socket.io, Prisma ORM
- **Database:** PostgreSQL (Supabase compatible)
- **File Uploads:** Cloudinary, Multer

## Core Features
- Real-time messaging (One-to-One & Channels)
- Typing indicators
- Online/Offline user status
- File and Image sharing via Cloudinary
- Secure JWT Authentication
- Responsive, modern UI

## Getting Started

### Prerequisites
- Node.js installed
- A PostgreSQL Database (e.g. from Supabase)
- Cloudinary Account for file uploads

### 1. Database & Backend Setup
1. Open the `backend` folder.
2. Copy `.env.example` to `.env` and fill in your credentials:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
3. Install dependencies:
   ```bash
   npm install
   ```
4. Push the Prisma schema to your database (Make sure your database is empty or safe to push to):
   ```bash
   npx prisma db push
   ```
5. Start the backend server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Open the `frontend` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage
Open the application in your browser (usually `http://localhost:5173`). Register multiple users in different tabs or incognito windows to test real-time features!
