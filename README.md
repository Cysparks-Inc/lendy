# 🏦 Napol Microfinance - Core Management System

A comprehensive, modern microfinance management system built with React, TypeScript, and Supabase. Designed to streamline loan management, member tracking, and financial operations for microfinance institutions.

## ✨ Features

### 🏠 **Dashboard & Analytics**
- **Real-time Statistics**: Live updates of loans, members, and financial metrics
- **Role-based Views**: Different dashboards for Super Admins, Branch Managers, and Loan Officers
- **Performance Metrics**: Collection rates, default rates, and portfolio health indicators
- **Recent Activity**: Latest loans, payments, and member activities

### 👥 **Member Management**
- **Comprehensive Profiles**: Complete member information with KYC details
- **Profile Pictures**: Image upload and management with compression
- **Next of Kin**: Multiple emergency contacts with relationships
- **Branch Assignment**: Automatic branch and loan officer assignment
- **Communication History**: Track all member interactions and notes

### 💰 **Loan Management**
- **Flexible Loan Types**: Support for various interest types and repayment schedules
- **Smart Member Search**: Real-time search-as-you-type member selection
- **Payment Tracking**: Comprehensive payment history and outstanding balance calculation
- **Status Management**: Active, pending, repaid, and defaulted loan states
- **Loan Officer Assignment**: Automatic and manual officer assignment

### 🏢 **Branch & Group Management**
- **Multi-branch Support**: Centralized management of multiple locations
- **Group Lending**: Support for group-based lending models
- **Officer Management**: Track loan officer performance and portfolio
- **Geographic Distribution**: Location-based member and loan organization

### 🔐 **Security & Access Control**
- **Role-based Access**: Super Admin, Branch Manager, Loan Officer, and Staff roles
- **Secure Authentication**: Supabase Auth with password policies
- **User Management**: Create, edit, and manage user accounts
- **Password Reset**: Administrative password reset capabilities

### 📱 **Responsive Design**
- **Mobile-First**: Optimized for mobile devices and tablets
- **Modern UI**: Beautiful green gradient branding with smooth animations
- **Touch-Friendly**: Optimized for touch devices and mobile interactions
- **Responsive Layouts**: Adaptive designs for all screen sizes

## 🚀 Technology Stack

### **Frontend**
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development with strict type checking
- **Tailwind CSS** - Utility-first CSS framework for rapid styling
- **shadcn/ui** - High-quality, accessible UI components
- **React Router** - Client-side routing and navigation
- **React Hook Form** - Performant forms with validation

### **Backend & Database**
- **Supabase** - Open-source Firebase alternative
- **PostgreSQL** - Robust relational database
- **Real-time Subscriptions** - Live data updates across the application
- **Row Level Security** - Database-level access control
- **Edge Functions** - Serverless backend functions

### **Development Tools**
- **Vite** - Fast build tool and development server
- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting and style consistency
- **Bun** - Fast package manager and runtime

## 📋 Prerequisites

Before running this project, ensure you have:

- **Node.js** 18+ or **Bun** 1.0+
- **Git** for version control
- **Supabase Account** for backend services
- **Modern Browser** (Chrome, Firefox, Safari, Edge)

## 🛠️ Installation & Setup

### 1. **Clone the Repository**
```bash
git clone <your-repository-url>
cd lend-wise-core
```

### 2. **Install Dependencies**
```bash
# Using npm
npm install

# Using yarn
yarn install

# Using bun (recommended)
bun install
```

### 3. **Environment Configuration**
Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. **Supabase Setup**
1. Create a new Supabase project
2. Set up the database schema (see Database Schema section)
3. Configure authentication settings
4. Set up storage buckets for profile pictures
5. Configure Row Level Security policies

### 5. **Start Development Server**
```bash
# Using npm
npm run dev

# Using yarn
yarn dev

# Using bun
bun dev
```

The application will be available at `http://localhost:5173`

## 🗄️ Database Schema

### **Core Tables**

#### **profiles**
- User account information and roles
- Role-based access control
- Branch assignments

#### **members**
- Member personal information
- KYC details and contact information
- Branch and officer assignments
- Next of kin relationships

#### **loans**
- Loan details and terms
- Principal amounts and interest rates
- Payment schedules and status
- Outstanding balances

#### **payments**
- Payment records and history
- Payment types and amounts
- Transaction timestamps

#### **branches**
- Branch information and locations
- Branch managers and staff

#### **groups**
- Group lending information
- Member associations
- Group officers

### **Supporting Tables**
- `next_of_kin` - Emergency contacts
- `communication_logs` - Member interaction history
- `loan_officers` - Officer performance tracking

## 🔧 Configuration

### **Tailwind CSS**
The project uses Tailwind CSS with custom brand colors:

```css
/* Custom brand colors */
--brand-green-50: #f0fdf4
--brand-green-100: #dcfce7
--brand-green-200: #bbf7d0
--brand-green-300: #86efac
--brand-green-600: #16a34a
--brand-green-700: #15803d
--brand-green-800: #166534
```

### **Component Library**
Built with shadcn/ui components for consistency and accessibility:
- Cards, Buttons, Forms, Tables
- Dialogs, Dropdowns, Navigation
- Responsive layouts and mobile optimization

## 📱 Usage Guide

### **For Super Admins**
1. **Dashboard**: View system-wide statistics and performance
2. **User Management**: Create and manage all user accounts
3. **Branch Management**: Oversee all branches and operations
4. **Security Settings**: Configure system-wide security policies

### **For Branch Managers**
1. **Branch Dashboard**: View branch-specific metrics
2. **Member Management**: Oversee member registration and profiles
3. **Loan Approval**: Review and approve loan applications
4. **Officer Management**: Manage loan officer assignments

### **For Loan Officers**
1. **Personal Dashboard**: View assigned loans and performance
2. **Member Interaction**: Log communications and track relationships
3. **Loan Management**: Create and manage loan applications
4. **Payment Collection**: Record payments and track collections

### **For Staff**
1. **Member Registration**: Basic member information entry
2. **Data Entry**: Update member and loan information
3. **Report Generation**: Generate basic reports and statements

## 🚀 Deployment

### **Build for Production**
```bash
# Using npm
npm run build

# Using yarn
yarn build

# Using bun
bun run build
```

### **Deploy to Vercel**
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main branch

### **Deploy to Netlify**
1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`

## 🔒 Security Features

### **Authentication**
- Supabase Auth with secure password policies
- JWT token management
- Session timeout and security

### **Authorization**
- Role-based access control (RBAC)
- Row Level Security (RLS) policies
- API endpoint protection

### **Data Protection**
- Encrypted data transmission
- Secure file uploads
- Input validation and sanitization

## 📊 Performance Optimizations

### **Frontend**
- React.memo for component optimization
- Lazy loading for routes
- Image compression and optimization
- Efficient state management

### **Backend**
- Database query optimization
- Real-time subscriptions with filtering
- Efficient pagination and data loading
- Caching strategies

## 🧪 Testing

### **Run Tests**
```bash
# Using npm
npm run test

# Using yarn
yarn test

# Using bun
bun test
```

### **Test Coverage**
- Component testing with React Testing Library
- Unit tests for utility functions
- Integration tests for API calls
- E2E tests for critical user flows

## 🐛 Troubleshooting

### **Common Issues**

#### **Build Errors**
- Clear node_modules and reinstall dependencies
- Check Node.js version compatibility
- Verify environment variables

#### **Database Connection Issues**
- Verify Supabase credentials
- Check network connectivity
- Verify RLS policies

#### **Authentication Problems**
- Clear browser storage
- Check Supabase Auth settings
- Verify user role assignments

### **Getting Help**
1. Check existing issues in the repository
2. Review Supabase documentation
3. Check React and TypeScript documentation
4. Create a new issue with detailed information

## 🤝 Contributing

### **Development Workflow**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### **Code Standards**
- Follow TypeScript best practices
- Use consistent formatting with Prettier
- Follow ESLint rules
- Write meaningful commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase** for the excellent backend platform
- **shadcn/ui** for the beautiful component library
- **Tailwind CSS** for the utility-first CSS framework
- **React Team** for the amazing frontend framework

## 📞 Support

For support and questions:
- **Email**: [info@samuelmogul.com]
- **Issues**: [GitHub Issues](https://github.com/mogulke/lend-wise-core/issues)
- **Documentation**: [Project Wiki](https://github.com/mogulke/lend-wise-core/wiki)

---

**Built with ❤️ for the microfinance community**

*Last updated: September 2025*
