import { PrismaClient, Contact} from '@prisma/client';

export const reconcileContact = async (
  prisma: PrismaClient,
  email?: string,
  phoneNumber?: string
) => {
    // Input validation
    if (!email && !phoneNumber) {
        throw new Error('Either email or phoneNumber must be provided');
    }

    return await prisma.$transaction(async (tx) => {
        const contacts = await tx.contact.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { email: email ?? undefined },
                        { phoneNumber: phoneNumber ?? undefined },
                    ],
                },
                { deletedAt: null },
            ],
        },
        orderBy: { createdAt: 'asc' }
    });        
    
    // Create new contact if no matches
    if (contacts.length === 0) {
            const newContact = await tx.contact.create({
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
    const primaryIds = contacts.filter(c => c.linkPrecedence === 'primary').map(c => c.id);        const allRelatedContacts = await tx.contact.findMany({
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

    // Prepare update list (convert other primaries to secondary) - use all related contacts
    const contactToUpdate = allPrimaryContacts.filter(
        c => c.id !== truePrimaryContact.id
    );        
    // Batch Update in DB (convert to secondary and set linkedId)
    if (contactToUpdate.length > 0) {
        await tx.contact.updateMany({
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

    if (truePrimaryContact.email) emails.add(truePrimaryContact.email);
    if (truePrimaryContact.phoneNumber) phoneNumbers.add(truePrimaryContact.phoneNumber);

    secondaryContacts.forEach(c => {
        if (c.email) emails.add(c.email);
        if (c.phoneNumber) phoneNumbers.add(c.phoneNumber);
    });

    // Check if new info is provided and not present in existing contacts
    const isNewEmail = email && !emails.has(email);
    const isNewPhone = phoneNumber && !phoneNumbers.has(phoneNumber);        
    if (isNewEmail || isNewPhone) {
        const newContact = await tx.contact.create({
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
    
    // Build response arrays 
    const responseEmails = Array.from(emails);
    const responsePhoneNumbers = Array.from(phoneNumbers);
    
    // Ensure primary contact info is first with null safety
    const finalEmails = truePrimaryContact.email 
        ? [truePrimaryContact.email, ...responseEmails.filter(e => e !== truePrimaryContact.email)]
        : responseEmails;
        
    const finalPhoneNumbers = truePrimaryContact.phoneNumber
        ? [truePrimaryContact.phoneNumber, ...responsePhoneNumbers.filter(p => p !== truePrimaryContact.phoneNumber)]
        : responsePhoneNumbers;        return {
            primaryContactId: truePrimaryContact.id,
            emails: finalEmails,
            phoneNumbers: finalPhoneNumbers,
            secondaryContactIds: secondaryContacts.map(c => c.id),
        };
    });
};


