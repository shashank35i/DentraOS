# Dental Clinic AI - Complete Dependencies & Versions

## Project Overview
A comprehensive dental clinic management system with AI-powered agents, real-time analytics, and integrated payment gateway.

---

## Backend (Node.js/Express)

### Runtime & Framework
- **Node.js**: v25.2.1 (or compatible)
- **Express**: ^5.2.1 - Web framework for REST APIs

### Authentication & Security
- **bcryptjs**: ^3.0.3 - Password hashing
- **jsonwebtoken**: ^9.0.3 - JWT token generation and verification
- **helmet**: ^8.1.0 - HTTP security headers
- **express-rate-limit**: ^8.2.1 - Rate limiting middleware
- **cors**: ^2.8.5 - Cross-Origin Resource Sharing

### Database
- **mysql2**: ^3.15.3 - MySQL database driver with promise support

### File Handling & PDF
- **multer**: ^2.0.2 - File upload middleware
- **pdfkit**: ^0.17.2 - PDF generation

### Email & Notifications
- **nodemailer**: ^7.0.11 - Email sending service

### Configuration
- **dotenv**: ^17.2.3 - Environment variable management

### AI & External APIs
- **openai**: ^6.14.0 - OpenAI API client for GPT integration

### Development
- **uvicorn**: ^0.0.1-security - ASGI server (for Python integration)

---

## Frontend (React + TypeScript + Vite)

### Core Framework
- **React**: ^18.3.1 - UI library
- **React DOM**: ^18.3.1 - React rendering for web
- **React Router DOM**: ^6.26.2 - Client-side routing

### Build Tool
- **Vite**: ^5.2.0 - Next-generation frontend build tool
- **@vitejs/plugin-react**: ^4.2.1 - React plugin for Vite

### Styling
- **Tailwind CSS**: 3.4.17 - Utility-first CSS framework
- **PostCSS**: latest - CSS transformation tool
- **Autoprefixer**: latest - Vendor prefix automation

### UI Components & Icons
- **lucide-react**: 0.522.0 - Icon library (fixed version)
- **recharts**: ^2.12.7 - React charting library

### Language & Type Safety
- **TypeScript**: ^5.5.4 - Static type checking
- **@types/react**: ^18.3.1 - React type definitions
- **@types/react-dom**: ^18.3.1 - React DOM type definitions
- **@types/node**: ^20.11.18 - Node.js type definitions

### Code Quality
- **ESLint**: ^8.50.0 - JavaScript linter
- **@typescript-eslint/parser**: ^5.54.0 - TypeScript parser for ESLint
- **@typescript-eslint/eslint-plugin**: ^5.54.0 - TypeScript ESLint rules
- **eslint-plugin-react-hooks**: ^4.6.0 - React hooks linting
- **eslint-plugin-react-refresh**: ^0.4.1 - React refresh linting

---

## Python Backend Services

### Assistant Service (FastAPI)

#### Web Framework
- **fastapi**: 0.115.6 - Modern Python web framework
- **uvicorn**: 0.32.1 - ASGI server for FastAPI

#### Database
- **mysql-connector-python**: 9.0.0 - MySQL database connector

#### Authentication
- **PyJWT**: 2.10.1 - JWT token handling

#### Machine Learning
- **scikit-learn**: 1.5.2 - ML library for intent classification
- **joblib**: 1.4.2 - Model serialization and caching

#### Configuration
- **python-dotenv**: 1.0.1 - Environment variable management

---

### Dental Agents Service

#### Database
- **mysql-connector-python**: 9.0.0 - MySQL database connector

#### Configuration
- **python-dotenv**: 1.0.1 - Environment variable management

#### HTTP Requests
- **requests**: 2.32.3 - HTTP library for API calls

#### Document Generation
- **reportlab**: 4.2.5 - PDF generation library

---

## Database

### MySQL/MariaDB
- **Version**: 8.4 (MariaDB compatible)
- **Port**: 3307 (primary), 3306 (secondary)
- **Character Set**: utf8mb4
- **Collation**: utf8mb4_unicode_ci

---

## System Requirements

### Operating System
- **Windows**: 10 or later (tested on Windows 11)
- **Shell**: PowerShell or CMD

### Runtime Environments
- **Node.js**: v25.2.1 or compatible
- **Python**: 3.14 or compatible
- **MySQL**: 8.0+ or MariaDB 8.4+

### Development Tools
- **npm**: 10.x or later (comes with Node.js)
- **pip**: Python package manager
- **Git**: Version control (optional)

---

## Key Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + TypeScript | 18.3.1 + 5.5.4 |
| **Frontend Build** | Vite | 5.2.0 |
| **Styling** | Tailwind CSS | 3.4.17 |
| **Backend API** | Express.js | 5.2.1 |
| **Backend Runtime** | Node.js | 25.2.1 |
| **Python Services** | FastAPI | 0.115.6 |
| **Database** | MySQL/MariaDB | 8.4 |
| **Authentication** | JWT + bcrypt | 9.0.3 + 3.0.3 |
| **AI Integration** | OpenAI API | 6.14.0 |
| **ML Models** | scikit-learn | 1.5.2 |

---

## Installation Commands

### Backend Dependencies
```bash
cd Backend
npm install
```

### Frontend Dependencies
```bash
cd Frontend
npm install
```

### Python Dental Agents / Worker (core)
~~~bash
cd Backend
pip install -r requirements-core.txt
~~~

### Python Assistant Service (optional, Python >=3.8)
~~~bash
cd Backend
pip install -r requirements-assistant.txt
~~~

---

## Environment Setup

### Required Environment Variables
```
# Backend (.env)
PORT=4000
DB_HOST=localhost
DB_PORT=3307
DB_USER=dental_app
DB_PASSWORD=
DB_NAME=dental_clinic
JWT_SECRET=dental_clinic
CLIENT_ORIGIN=http://localhost:5173
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:4000

# Assistant Service (.env)
PORT=8010
DB_HOST=localhost
DB_PORT=3307
DB_USER=dental_app
DB_PASSWORD=
DB_NAME=dental_clinic
JWT_SECRET=dental_clinic
```

---

## Features Enabled by These Dependencies

### Authentication & Security
- JWT-based authentication (jsonwebtoken)
- Password hashing with bcryptjs
- Rate limiting for API protection
- CORS support for cross-origin requests
- Security headers with Helmet

### Database
- MySQL connection pooling
- Promise-based queries
- Transaction support

### File Management
- File uploads with multer
- PDF generation with pdfkit

### AI & ML
- OpenAI GPT integration
- Intent classification with scikit-learn
- Model persistence with joblib

### Frontend
- Component-based UI with React
- Type-safe development with TypeScript
- Fast development with Vite
- Beautiful UI with Tailwind CSS
- Interactive charts with recharts
- Icon library with lucide-react

### Real-time Features
- Server-Sent Events (SSE) for notifications
- WebSocket-ready architecture

---

## Version Compatibility Notes

- **Node.js**: Tested with v25.2.1, compatible with v18+
- **Python**: Tested with 3.14, compatible with 3.10+
- **MySQL**: Tested with 8.4, compatible with 8.0+
- **React**: 18.3.1 requires Node 14+
- **TypeScript**: 5.5.4 requires Node 14.17+
- **Vite**: 5.2.0 requires Node 14.18+

---

## Security Considerations

- All passwords are hashed with bcryptjs (10 salt rounds)
- JWT tokens expire based on application logic
- Rate limiting prevents brute force attacks
- CORS is configured for specific origins
- Environment variables store sensitive data
- SQL injection prevention through parameterized queries

---

## Performance Optimizations

- Connection pooling in MySQL
- Caching with joblib for ML models
- Vite's fast HMR for development
- Tailwind CSS purging for production
- React lazy loading support
- Express middleware optimization

---

## Last Updated
January 27, 2026

## Project Status
âœ… Production Ready with Demo Data
- All services running
- Payment gateway integrated
- AI case summaries implemented
- Revenue analytics functional
- Patient portal with payment integration
