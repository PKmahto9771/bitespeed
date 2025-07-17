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

    // Get complete contact chain in single query
    const linkedIds = contacts.map(c => c.linkedId).filter(Boolean) as number[];
    const primaryIds = contacts.filter(c => c.linkPrecedence === 'primary').map(c => c.id);
    
    const allRelatedContacts = await prisma.contact.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { id: { in: contacts.map(c => c.id) } },
                        { id: { in: linkedIds } },
                        { linkedId: { in: primaryIds } },
                    ],
                },
                { deletedAt: null },
            ],
        },
        orderBy: { createdAt: 'asc' }
    });

    // Process all contacts in memory 
    const allPrimaryContacts = allRelatedContacts.filter(c => c.linkPrecedence === 'primary');
    const truePrimaryContact = allPrimaryContacts.reduce((min, c) => (c.id < min.id ? c : min));

    // Prepare update list (convert other primaries to secondary)
    const contactToUpdate = contacts.filter(
    c => c.id !== truePrimaryContact.id && c.linkPrecedence === 'primary'
    );

    // Batch Update in DB (convert to secondary and set linkedId)
    if (contactToUpdate.length > 0) {
        await prisma.contact.updateMany({
            where: {
                id: { in: contactToUpdate.map(c => c.id) },
            },
            data: {
                linkPrecedence: 'secondary',
                linkedId: truePrimaryContact.id,
            },
        });
    }

    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();

    const secondaryContacts = allRelatedContacts.filter(
        c => c.id !== truePrimaryContact.id
    );

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


