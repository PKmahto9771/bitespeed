# BiteSpeed Identity Reconciliation

A robust contact identity reconciliation service that helps identify and consolidate customer contact information across multiple touchpoints.

**Live Backend URL**: https://bitespeed-pran.onrender.com

## 🚀 Features

- **Contact Reconciliation**: Automatically merge duplicate contacts based on email and phone number
- **Primary/Secondary Linking**: Maintains hierarchical contact relationships
- **RESTful API**: Simple HTTP endpoints for contact identification
- **PostgreSQL Integration**: Reliable data storage with Prisma ORM

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/PKmahto9771/bitespeed.git
   cd bitespeed
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/bitespeed_db"
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate deploy
   ```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Build the application
npm run build

# Start the production server
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📡 API Endpoints

### Contact Identification
```http
POST /identify
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["user@example.com", "user.alt@example.com"],
    "phoneNumbers": ["+1234567890", "+0987654321"],
    "secondaryContactIds": [2, 3]
  }
}
```

## 🗄️ Database Schema

The application uses a single `Contact` table with the following structure:

```sql
Contact {
  id             Int       @id @default(autoincrement())
  phoneNumber    String?   @db.VarChar(255)
  email          String?   @db.VarChar(255)
  linkedId       Int?      -- References the primary contact
  linkPrecedence String    @default("primary") -- "primary" or "secondary"
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime? -- Soft delete support
}
```

## 🔄 Contact Reconciliation Logic

1. **New Contact**: If no existing contact matches the provided email/phone, create a new primary contact
2. **Existing Match**: If contacts exist with matching email/phone:
   - Find all related contacts in the chain
   - Identify the primary contact (oldest by creation date)
   - Convert other primaries to secondary contacts
   - Link all contacts to the true primary
3. **New Information**: If new email/phone provided, create a secondary contact linked to the primary

## 📁 Project Structure

```
src/
├── controllers/
│   └── identifyController.ts    # API request handlers
├── routes/
│   └── identify.ts             # Route definitions
├── utils/
│   └── reconcile.ts            # Core reconciliation logic
├── index.ts                    # Application entry point
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
└── package.json
```

## 🧪 Testing

### Manual Testing with curl

**Create a new contact:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "+1234567890"}'
```

**Link contacts by email:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "+9876543210"}'
```

### Database Inspection

View your contacts directly:
```bash
npx prisma studio
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3000 |


### Manual Deployment

1. Build the application: `npm run install && build`
2. Set up PostgreSQL database
4. Start the server: `npm start`

---

Built with ❤️ using Node.js, Express, TypeScript, and Prisma.
