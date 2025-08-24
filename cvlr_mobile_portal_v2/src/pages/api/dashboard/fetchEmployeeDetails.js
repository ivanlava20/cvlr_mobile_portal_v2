import admin from 'firebase-admin';
import serviceAccount from '../../../lib/prodServiceAccountKey.json';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { month, year } = req.body;

    // Validate input parameters
    if (!month || !year) {
      return res.status(400).json({ 
        error: 'Month and year are required parameters' 
      });
    }

    // Validate month range
    if (month < 1 || month > 12) {
      return res.status(400).json({ 
        error: 'Month must be between 1 and 12' 
      });
    }

    // Get all active employees
    const employeesSnapshot = await db
      .collection('EMPLOYEE_INFORMATION')
      .where('employmentStatus', '==', 'ACTIVE')
      .get();

    const upcomingBirthdays = [];
    const upcomingAnniversaries = [];

    employeesSnapshot.forEach((doc) => {
      const employee = doc.data();
      const employeeId = doc.id;

      // Check if employee has required fields
      if (!employee.firstName || !employee.lastName) {
        return; // Skip this employee
      }

      const employeeName = `${employee.lastName}, ${employee.firstName}`;

      // Check for birthday in the specified month
      if (employee.dateOfBirth) {
        // Parse YYYY-MM-DD format properly
        const birthDateParts = employee.dateOfBirth.split('-');
        const birthMonth = parseInt(birthDateParts[1], 10); // Extract month directly
        
        if (birthMonth === parseInt(month)) {
          upcomingBirthdays.push({
            employeeId,
            employeeName,
            dateOfBirth: employee.dateOfBirth
          });
        }
      }

      // Check for work anniversary in the specified month
      if (employee.hireDate) {
        // Parse YYYY-MM-DD format properly
        const hireDateParts = employee.hireDate.split('-');
        const hireYear = parseInt(hireDateParts[0], 10);
        const hireMonth = parseInt(hireDateParts[1], 10);
        
        // Check if employee will have worked for at least 1 year by the target date
        const targetYear = parseInt(year);
        const yearsWorked = targetYear - hireYear;
        
        if (hireMonth === parseInt(month) && yearsWorked >= 1) {
          upcomingAnniversaries.push({
            employeeId,
            employeeName,
            hireDate: employee.hireDate
          });
        }
      }
    });

    // Sort by date within the month
    upcomingBirthdays.sort((a, b) => {
      const dayA = parseInt(a.dateOfBirth.split('-')[2], 10);
      const dayB = parseInt(b.dateOfBirth.split('-')[2], 10);
      return dayA - dayB;
    });

    upcomingAnniversaries.sort((a, b) => {
      const dayA = parseInt(a.hireDate.split('-')[2], 10);
      const dayB = parseInt(b.hireDate.split('-')[2], 10);
      return dayA - dayB;
    });

    return res.status(200).json({
      upcomingBirthday: upcomingBirthdays,
      upcomingAnniversaries: upcomingAnniversaries
    });

  } catch (error) {
    console.error('Error fetching employee details:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}