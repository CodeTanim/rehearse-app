# 🧠 Rehearse

> _Intelligent skill retention platform that prevents knowledge decay through AI-powered practice and visual progress tracking_

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

[Live Demo](#) • [Documentation](#) • [Report Bug](#) • [Request Feature](#)

</div>

---

## 🎯 Overview

**Rehearse** is a comprehensive skill retention platform designed to combat the inevitable decay of learned knowledge. Whether you're a medical student juggling thousands of concepts, a software engineer maintaining expertise across multiple technologies, or any professional seeking to retain complex information over time, Rehearse provides intelligent practice reminders and visual decay tracking to keep your skills sharp.

### 🚀 The Problem We Solve

Knowledge decay is universal - studies show we forget up to 50% of new information within an hour and 90% within a week without reinforcement. Rehearse addresses this by:

- **Tracking skill degradation** over time using advanced algorithms
- **Delivering targeted practice** before significant decay occurs
- **Visualizing progress** to maintain motivation and awareness
- **Organizing learning materials** in intuitive, searchable folders

---

## ✨ Features

### 🔐 **User Authentication & Security**

- Secure user registration and login system
- Password reset and account management
- Protected routes and session management
- JWT-based authentication with NextAuth.js

### 📁 **Skill Folder Management**

- Create color-coded skill folders for different topics
- Organize learning materials by subject or project
- Folder statistics and material counts
- Search and filter capabilities

### 📄 **File & Note Management**

- **Multi-format file upload**: PDF, images, text files, and more
- **Advanced viewers**:
  - PDF.js integration with zoom, pan, and search
  - Image viewer with zoom and pan controls
  - Syntax-highlighted text/code viewer
- **Rich text editor**: Create and edit notes with formatting
- **File organization**: Drag-and-drop interface for material management
- **Thumbnail generation**: Quick previews for all file types

### 🧠 **AI-Powered Question Generation** _(Coming Soon)_

- Generate practice questions from uploaded materials using OpenAI
- Custom Q&A pair creation for personalized practice
- Intelligent question difficulty adjustment
- Context-aware explanations and hints

### 📊 **Skill Decay Tracking** _(Coming Soon)_

- **Visual decay dashboard**: See skill proficiency over time
- **Decay algorithm**: Python microservice calculating knowledge deterioration
- **Practice scheduling**: Smart reminders before skills decay significantly
- **Progress analytics**: Track improvement and retention rates

### 🎯 **Practice Sessions** _(Coming Soon)_

- Interactive practice interface with immediate feedback
- Multiple question types (multiple choice, short answer, essay)
- Performance tracking and analytics
- Spaced repetition optimization

### 📱 **Modern User Experience**

- Responsive design for desktop, tablet, and mobile
- Dark/light mode support
- Accessibility-first design (WCAG 2.1 compliant)
- Progressive Web App (PWA) capabilities
- Real-time updates and auto-save

---

## 🛠 Tech Stack

### Frontend

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Build Tool**: Turbopack for development

### Backend & Database

- **API**: Next.js API routes (full-stack)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5
- **File Storage**: Local + Cloud storage abstraction
- **Password Security**: bcryptjs hashing

### AI & Machine Learning _(In Development)_

- **AI Provider**: OpenAI API
- **ML Backend**: Python microservice
- **ML Framework**: scikit-learn
- **Use Cases**: Question generation, content analysis, decay prediction

### Infrastructure

- **Hosting**: Vercel
- **Database**: Supabase (managed PostgreSQL)
- **CI/CD**: GitHub Actions
- **Monitoring**: Built-in analytics and error tracking

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn package manager

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/rehearse-app.git
   cd rehearse-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Configure your `.env.local` with:

   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key"
   OPENAI_API_KEY="your-openai-key" # Optional, for AI features
   ```

4. **Set up the database**

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Run the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Commands

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build production application
npm start           # Start production server
npm run lint        # Run ESLint for code quality
npm run type-check  # Run TypeScript type checking
```

---

## 📋 Roadmap

### ✅ Phase 1: MVP Foundation (Completed)

- [x] User authentication system
- [x] Skill folder management
- [x] File & note upload system
- [x] Basic dashboard interface
- [x] File viewing infrastructure
- [x] Responsive design

### 🚧 Phase 2: AI & Decay Tracking (In Progress)

- [ ] Skill decay algorithm implementation
- [ ] OpenAI integration for question generation
- [ ] Practice session interface
- [ ] Decay visualization dashboard
- [ ] Practice scheduling system
- [ ] Performance analytics

### 🔮 Phase 3: Enhanced Features (Planned)

- [ ] Advanced practice modes (flashcards, timed tests)
- [ ] Collaborative study groups
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and insights
- [ ] Integration with external platforms
- [ ] Offline mode support

---

## 🏗 Project Structure

```
rehearse-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Main dashboard
│   │   └── practice/          # Practice sessions (WIP)
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── skill-folders/    # Folder management
│   │   ├── files/            # File handling
│   │   └── practice/         # Practice interface (WIP)
│   ├── lib/                   # Utilities and configurations
│   │   ├── auth.ts           # Authentication config
│   │   ├── db.ts             # Database connection
│   │   └── openai.ts         # AI integration (WIP)
│   └── hooks/                 # Custom React hooks
├── prisma/                    # Database schema and migrations
├── public/                    # Static assets
└── .agent-os/                # Development specifications
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📊 Target Audience

### 🎓 **Students**

- Medical students managing complex coursework
- Computer science students juggling multiple programming languages
- Graduate students maintaining research knowledge across semesters

### 👨‍💻 **Tech Professionals**

- Software engineers maintaining expertise across frameworks
- DevOps engineers tracking infrastructure knowledge
- Technical leads ensuring team knowledge retention

### 🏥 **Medical Professionals**

- Doctors maintaining continuing education requirements
- Nurses staying current with protocol updates
- Medical researchers tracking study methodologies

---

## 📈 Performance & Scalability

- **Fast Development**: Turbopack for lightning-fast builds
- **Optimized Images**: Next.js Image optimization
- **Database Performance**: Prisma with connection pooling
- **Caching Strategy**: Redis integration ready
- **CDN Ready**: Vercel Edge Network optimization
- **Progressive Loading**: Lazy loading for large datasets

---

## 🔒 Security & Privacy

- **Data Encryption**: All sensitive data encrypted at rest
- **Secure Authentication**: Industry-standard JWT implementation
- **Input Validation**: Comprehensive server-side validation
- **Rate Limiting**: API protection against abuse
- **Privacy First**: No unnecessary data collection
- **GDPR Compliant**: Data export and deletion tools

---


