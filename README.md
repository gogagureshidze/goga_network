<div align="center">

# 🌐 Goga Network

### *A Next-Gen Social Media Platform Built from Scratch* 

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)

*Developed solo by an 18-year-old CS student* 🎓

[Live Demo](https://goga.network/) 

</div>

---

## 🎯 What is Goga Network?

Goga Network is a **feature-rich social media platform** that combines the best of modern social networking with cutting-edge real-time technology. From sharing memories to AI-powered content moderation, it's a complete ecosystem built with performance and user experience in mind.

### ✨ The Goga Ecosystem

- **🌟 Goga.Network** - The main social platform
- **📝 Goga_Blog** - Community discussion hub for feature announcements and user engagement

---

## 🚀 Features That Make Goga Stand Out

### 📱 Core Social Features
- **Posts & Media Sharing** - Share text, photos, videos, and polls with your network
- **Stories** - 24-hour ephemeral content with image & video support
- **Events & Locations** - Create and share events with location tagging
- **Albums** - Organize your memories into beautiful shareable albums
- **Activity Tracking** - See who viewed your posts and stories in real-time

### 💬 Real-Time Communication

These upgrades are implemented on the communications branch and require the staging checks below before production release. Real device interoperability is not yet certified.
- **Instant Messaging** - Lightning-fast chat powered by Socket.io
- **Voice notes and group chat** - Private audio storage, roles and invitations
- **Voice & Video Calls** - Native one-to-one WebRTC and screen sharing; group LiveKit disabled pending security and capacity validation
- **Watch parties** - Authorized direct media playback synchronized through Socket.IO
- **Media Sharing** - Send images and videos directly in conversations
- **Online Status** - Live user presence tracking
- **Message Delivery** - Real-time message status updates

### 🎨 Personalization & Customization
- **Animated Bio** - Express yourself with animated profile customizations
- **Personal Touch** - Make your profile truly yours
- **User Tagging** - Tag friends in posts and bios
- **Profile Management** - Complete control over your digital identity

### 🤖 AI-Powered Intelligence
- **Content Moderation** - Automatic detection and blocking of explicit content
- **Smart Suggestions** - AI-assisted post description generation
- **Safe Community** - Keeping the platform family-friendly with ML

### 👥 Social Dynamics
- **Friend Requests** - Connect with others seamlessly
- **Follow System** - Stay updated with your favorite creators
- **Block & Privacy** - Full control over who sees your content
- **Engagement** - Like, comment, and reply to build community
- **Share Posts** - Forward content through direct messages

### 🎊 Interactive Content
- **Polls** - Create engaging polls with live vote counts
- **Comments & Replies** - Nested conversations on posts
- **Post Sharing** - Share content across the platform

---

## 🛠️ Tech Stack

### Frontend & Backend
```typescript
• Next.js + TypeScript - Full-stack React framework
• Next.js Server Actions - Modern server-side operations
• Tailwind CSS - Utility-first styling framework
• Prisma ORM - Type-safe database client
• MySQL - Robust relational database
```

### Real-Time Infrastructure
```typescript
• Socket.io - WebSocket server for real-time features
• VPS Deployment - Self-hosted socket server
• Nginx - Reverse proxy & load balancing
```

### Media & Assets
```typescript
• Cloudinary - Media storage and optimization
• Image & Video CDN - Fast content delivery
```

---

## 🏗️ Architecture Highlights

### Real-Time Socket Server
The heart of Goga's instant features runs on a **custom VPS** with Socket.io, handling:
- ⚡ Real-time messaging between users
- 👀 Live online/offline status tracking
- 📊 Instant poll vote updates
- 🔔 Push notifications
- 📹 Call signaling

### Nginx Configuration
Professional-grade reverse proxy setup ensuring:
- 🚀 High-performance WebSocket connections
- 🔒 Secure SSL/TLS termination
- ⚖️ Load balancing capabilities

### Database Design
Prisma + MySQL architecture providing:
- 🔗 Complex relational data modeling
- 📈 Scalable user relationships
- 💾 Efficient query optimization
- 🔄 Seamless migrations

---

## 🎬 Current Development Status

> **⏱️ Timeline**: 2 months of active development  
> **👨‍💻 Team Size**: Solo developer (that's me!)  
> **📍 Location**: London, UK  
> **🎓 Background**: Computer Science student

### ✅ Completed Features
- [x] Core social posting system
- [x] Real-time messaging infrastructure
- [x] Stories with media support
- [x] AI content moderation
- [x] Friend/follow system
- [x] Profile customization
- [x] Events & locations
- [x] Albums & media management
- [x] Polls with live updates
- [ ] Voice & video calling production validation (implementation available on the communications branch)
- [x] Online status tracking

### 🚧 In Progress
- [ ] Enhanced AI suggestions
- [ ] Advanced analytics dashboard
- [ ] Goga_Blog platform expansion
- [ ] Performance optimizations
- [ ] Additional customization options

---

## 💡 Why Goga Network?

> *"Building a social media platform from scratch isn't just about code—it's about creating connections, fostering community, and pushing the boundaries of what one developer can achieve."*

### The Vision
Goga Network was born from a simple idea: **what if social media was built by someone who actually uses it?** No corporate bureaucracy, no endless committees—just pure, focused development driven by passion and creativity.

### The Challenge
Creating a full-featured social platform as a solo developer means:
- 🧩 Architecting scalable systems
- ⚡ Optimizing for performance at every layer
- 🎨 Designing intuitive user experiences
- 🔒 Implementing robust security measures
- 🤖 Integrating cutting-edge AI technology

---
## ⚠️ Important Development Note
<div style="background-color: #fff3cd; border-left: 6px solid #ffc107; padding: 10px; margin-bottom: 20px; color: #856404; border-radius: 4px;">
<strong>Heads Up:</strong> Some advanced features are still in active development and testing. They are not yet live in the production environment but represent the platform's immediate roadmap and demonstrated capabilities.
</div>

## 🚦 Getting Started

```bash
# Clone the repository
git clone https://github.com/gogagureshidze/goga_network.git

# Use Node 24 LTS and install locked dependencies
cd goga_network
npm ci

# Set up environment variables
cp .env.example .env

# Configure a DISPOSABLE local database and Clerk development instance first.
# Empty local databases only; existing databases need baseline reconciliation.
npm run db:deploy

# Start the app; load socket settings securely in a second terminal and run npm run socket.
npm run dev
```

---

## Communications release and verification

Start with [the architecture audit](docs/architecture-audit.md), [recorded validation](docs/validation.md), [the two-device test procedure](docs/media-test-procedure.md), and [operations, backups and rollback](docs/operations.md). Configuration names are in [.env.example](.env.example); use separate app and socket environments, including separate PORT values. [Secure access setup](docs/deployment-access.md) is an operator step, not an automatic deployment.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The guarded MySQL integration suite requires the disposable loopback database described in the operations guide. CI performs checks only. No production deployment or infrastructure modification is automated.

## 📸 Screenshots

*Coming soon! The platform is live and screenshots will be added shortly.*

---

## 🤝 Contributing

While Goga Network is currently a solo project, I'm always open to:
- 🐛 Bug reports
- 💡 Feature suggestions
- 📝 Documentation improvements
- 🎨 Design feedback

Feel free to open an issue or reach out!

---

## 📬 Connect With Me

Building Goga Network has been an incredible journey, and I'd love to hear your thoughts!


- **📧 Email**: [gogagureshidze8@gmail.com](#)



<div align="center">

### 🚀 Built with passion by a solo developer

**⭐ If you find this project interesting, consider starring it!**

*Made with ❤️ *

</div>
