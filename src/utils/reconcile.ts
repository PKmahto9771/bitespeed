import { PrismaClient, Contact} from '@prisma/client';

export const reconcileContact = async (
  prisma: PrismaClient,
  email?: string,
  phoneNumber?: string
) => {
    const contacts = await prisma.contact.findMany({
        where: {
        OR: [
            { email: email ?? undefined },
            { phoneNumber: phoneNumber ?? undefined },
        ],
        },
        orderBy: { createdAt: 'asc' }
    });

    // Create new contact if no matches
    if (contacts.length === 0) {
            const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: 'primary',
                deletedAt: null,
            },
        });

        return {
            primaryContactId: newContact.id,
            emails: [newContact.email],
            phoneNumbers: [newContact.phoneNumber],
            secondaryContactIds: [],
        };
    }

    // Step 1: Get all contacts marked as 'primary'
    const primaryContacts: Contact[] = contacts.filter(c => c.linkPrecedence === 'primary');
    if (primaryContacts.length === 0 && contacts.length > 0) {
        // If no primary contacts, check for linked contacts
        const linkedContacts = await prisma.contact.findMany({
            where: {
                id: contacts[0].linkedId ?? undefined,
                linkPrecedence: 'primary',
            },
        });
        primaryContacts.push(...linkedContacts);
    }
    
    // Step 2: Choose the one with the lowest ID
    const truePrimaryContact = primaryContacts.reduce((min, c) => (c.id < min.id ? c : min));

    // Step 3: Prepare update list (convert other primaries to secondary)
    const contactToUpdate = contacts.filter(
    c => c.id !== truePrimaryContact.id && c.linkPrecedence === 'primary'
    );

    // Step 4: Update in DB (convert to secondary and set linkedId)
    for (const contact of contactToUpdate) {
        await prisma.contact.update({
            where: { id: contact.id },
            data: {
            linkPrecedence: 'secondary',
            linkedId: truePrimaryContact.id,
            },
        });
    }

    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();

    const secondaryContacts: Contact[] = await prisma.contact.findMany({
        where: {
            linkedId: truePrimaryContact.id,
            linkPrecedence: 'secondary',
        },
    });

    emails.add(truePrimaryContact.email!);
    phoneNumbers.add(truePrimaryContact.phoneNumber!);
    secondaryContacts.forEach(c => {
        if (c.email) emails.add(c.email);
        if (c.phoneNumber) phoneNumbers.add(c.phoneNumber);
    });

  // Check if new info is provided and not present in existing contacts
  const isNewEmail = email && ![...emails].includes(email);
  const isNewPhone = phoneNumber && ![...phoneNumbers].includes(phoneNumber);

    if (isNewEmail || isNewPhone) {
        const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: 'secondary',
                linkedId: truePrimaryContact.id,
                deletedAt: null,
            },
        });
        secondaryContacts.push(newContact);
        if (email) emails.add(email);
        if (phoneNumber) phoneNumbers.add(phoneNumber);
    }
    
  return {
    primaryContactId: truePrimaryContact.id,
    emails: [truePrimaryContact.email!, ...[...emails].filter(e => e !== truePrimaryContact.email)],
    phoneNumbers: [truePrimaryContact.phoneNumber!, ...[...phoneNumbers].filter(p => p !== truePrimaryContact.phoneNumber)],
    secondaryContactIds: secondaryContacts.map(c => c.id),
  };
};


