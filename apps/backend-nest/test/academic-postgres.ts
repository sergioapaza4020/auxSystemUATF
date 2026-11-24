import { createSeedTestDatabase } from './seeders-postgres';

/** Synthetic academic data on a cluster whose ownership was verified by the shared helper. */
export async function createAcademicTestDatabase(pgBin: string) {
  const database = await createSeedTestDatabase(pgBin);
  const source = database.source;
  try {
    await source.runMigrations({ transaction: 'each' });
    await source.query(`INSERT INTO users(email,username,password,name,lastname,ci)
      SELECT 'academic-'||n||'@test.invalid','academic-'||n,'unused','Synthetic','Fixture','academic-'||n
      FROM generate_series(1,4)n`);
    await source.query(`INSERT INTO courses(name,code,"group")
      VALUES('Synthetic academic course','ACADEMIC',1),('Foreign synthetic course','FOREIGN',1)`);
    const year = new Date().getUTCFullYear();
    await source.query(
      `INSERT INTO semesters(year,semester_number,start_date,end_date) VALUES($1,'II',$2,$3)`,
      [year, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))],
    );
    await source.query(`INSERT INTO enrollments(id_user,id_course,id_semester,role)
      VALUES(1,1,1,'ASSISTANT'),(2,1,1,'STUDENT'),(3,1,1,'STUDENT'),(4,2,1,'STUDENT')`);
    await source.query(`INSERT INTO grade_items(name) VALUES('Synthetic practical criterion')`);
    await source.query(`INSERT INTO grade_schemes(name,id_assistant_enrollment,assistant_percentage)
      VALUES('Synthetic academic scheme',1,20)`);
    await source.query(`INSERT INTO grade_scheme_details(id_grade_scheme,id_grade_item,percentage,"order")
      VALUES(1,1,100,1)`);
    return database;
  } catch (error: unknown) {
    await database.close();
    throw error;
  }
}
