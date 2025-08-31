const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  try {
    const files = await prisma.file.findMany({
      include: {
        skillFolder: true
      }
    })
    
    console.log('Files in database:')
    files.forEach(file => {
      console.log(`- ID: ${file.id}`)
      console.log(`  Name: ${file.originalName}`)
      console.log(`  Path: ${file.filename}`)
      console.log(`  Folder: ${file.skillFolderId}`)
      console.log(`  User: ${file.skillFolder.userId}`)
      console.log()
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()