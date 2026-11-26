'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { Box, Grid, Stack } from '@mui/material';

import SectionNavigation from '@/components/SectionNavigation';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type {
  IAssistantGradeScheme,
  IAssistantGradeSchemeCreate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

import { UserRole } from '@/enums/userRole';

import { useGradeItems } from '@/hooks/grade-items';
import { useActivities } from '@/hooks/activities/useActivities';
import { useEnrollmentStudentsPage } from '@/hooks/enrollments/useEnrollmentStudentsPage';
import { hasPermission } from '@/utils/hasPermission';
import { useAuth } from '@/hooks/useAuth';
import { canImportEnrollmentStudents } from '@/utils/enrollmentImportAccess';

import { EnrollmentHeader } from './EnrollmentHeader';
import { GradeSchemeCard } from './GradeSchemeCard';
import { GradesCard } from './grades-card/GradesCard';
import { EnrollmentStudentsCard } from './EnrollmentStudentsCard';
import { AssistantGradeSchemeCard } from './AssistantGradeSchemeCard';
import { AssistantGradeSchemeDialog } from './AssistantGradeSchemeDialog';
import { ActivityManagementDialog } from './ActivityManagementDialog';
import { StudentEnrollmentView } from './grades-card/StudentEnrollmentView';

const assistantSections = [
  {
    id: 'assistant-enrollment-overview',
    label: 'Datos generales',
    icon: <i className='ri-file-list-3-line' aria-hidden />,
  },
  { id: 'assistant-enrollment-students', label: 'Estudiantes', icon: <i className='ri-group-line' aria-hidden /> },
] as const;

interface EnrollmentDetailProps {
  enrollment: IEnrollment;
  grades: IGrade[];
  students: IEnrollmentStudent[];
  loadingGrades: boolean;
  loadingStudents: boolean;
  gradesFeedback?: ReactNode;

  assistantGradeScheme: IAssistantGradeScheme | null;
  loadingAssistantGradeScheme: boolean;
  savingAssistantGradeScheme: boolean;

  onActivitiesChanged: () => Promise<void>;
  onCreateAssistantGradeScheme: (data: IAssistantGradeSchemeCreate) => Promise<IAssistantGradeScheme>;

  onUpdateAssistantGradeScheme: (
    idAssistantGradeScheme: number,
    data: IAssistantGradeSchemeCreate,
  ) => Promise<IAssistantGradeScheme>;
}

export function EnrollmentDetail(props: EnrollmentDetailProps) {
  if (props.enrollment.role === UserRole.STUDENT) {
    return (
      <StudentEnrollmentView
        enrollment={props.enrollment}
        grades={props.grades}
        loading={props.loadingGrades}
        gradesFeedback={props.gradesFeedback}
      />
    );
  }

  return <ManagedEnrollmentDetail {...props} />;
}

function ManagedEnrollmentDetail(props: EnrollmentDetailProps) {
  const {
    enrollment,
    grades,
    loadingGrades,
    assistantGradeScheme,
    loadingAssistantGradeScheme,
    savingAssistantGradeScheme,
    onActivitiesChanged,
    onCreateAssistantGradeScheme,
    onUpdateAssistantGradeScheme,
  } = props;

  const router = useRouter();
  const { user } = useAuth();

  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);

  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  const [selectedGradeSchemeDetailId, setSelectedGradeSchemeDetailId] = useState<number | null>(null);

  const [selectedGradeItemName, setSelectedGradeItemName] = useState('');

  const { gradeItems, loading: loadingGradeItems } = useGradeItems();

  const {
    activities,
    loading: loadingActivities,
    saving: savingActivity,
    create: createActivityHandler,
    update: updateActivityHandler,
    remove: removeActivityHandler,
  } = useActivities(selectedGradeSchemeDetailId, enrollment.course.idCourse, onActivitiesChanged);

  const isAssistant = enrollment.role === UserRole.ASSISTANT;
  const canReadGrades = hasPermission(user, 'grade.get-by-enrollment');

  const studentGrades = useEnrollmentStudentsPage(
    isAssistant ? enrollment.idEnrollment : null,
    canReadGrades,
    assistantGradeScheme,
  );

  return (
    <Stack spacing={3}>
      <EnrollmentHeader enrollment={enrollment} />
      {isAssistant && <SectionNavigation label='Secciones de la matrícula' items={assistantSections} scrollable />}

      <Grid container spacing={isAssistant ? 0 : 3}>
        {!isAssistant && (
          <Grid item xs={12} lg={5}>
            <GradeSchemeCard enrollment={enrollment} />
          </Grid>
        )}

        <Grid item xs={12} lg={isAssistant ? 12 : 7}>
          {isAssistant ? (
            <Box
              component='section'
              id={assistantSections[0].id}
              aria-label='Mi evaluación como auxiliar'
              tabIndex={-1}
            >
              <AssistantGradeSchemeCard
                scheme={assistantGradeScheme}
                loading={loadingAssistantGradeScheme}
                onConfigure={() => setAssistantDialogOpen(true)}
                onManageActivities={(idGradeSchemeDetail, gradeItemName) => {
                  setSelectedGradeSchemeDetailId(idGradeSchemeDetail);

                  setSelectedGradeItemName(gradeItemName);

                  setActivityDialogOpen(true);
                }}
                onManageAttendance={() => {
                  router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/attendance`);
                }}
              />
            </Box>
          ) : (
            <GradesCard enrollment={enrollment} grades={grades} loading={loadingGrades} />
          )}
        </Grid>
      </Grid>

      {isAssistant && (
        <Box component='section' id={assistantSections[1].id} aria-label='Estudiantes' tabIndex={-1}>
          <EnrollmentStudentsCard
            onManageGrades={
              canReadGrades && hasPermission(user, 'grade.create') && hasPermission(user, 'grade.update')
                ? () => router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/grades`)
                : undefined
            }
            onImportStudents={
              canImportEnrollmentStudents(user, enrollment)
                ? () => router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/students/import`)
                : undefined
            }
            pagination={studentGrades}
            onRefresh={studentGrades.reload}
            summary={studentGrades.summary}
            summaryLoading={studentGrades.loading}
            summaryError={studentGrades.error}
            onRetrySummary={studentGrades.reload}
            showGrades={canReadGrades}
            students={studentGrades.students}
            loading={studentGrades.loading}
            onSelectStudent={(student) => {
              router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/students/${student.idEnrollment}`);
            }}
            onManageAttendance={() => {
              router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/attendance`);
            }}
          />
        </Box>
      )}

      {isAssistant && (
        <AssistantGradeSchemeDialog
          open={assistantDialogOpen}
          loading={savingAssistantGradeScheme}
          gradeItems={gradeItems}
          loadingGradeItems={loadingGradeItems}
          archivedDetails={assistantGradeScheme?.archivedDetails}
          initialValue={
            assistantGradeScheme
              ? {
                  assistantPercentage: assistantGradeScheme.assistantPercentage,

                  name: assistantGradeScheme.name,

                  description: assistantGradeScheme.description ?? '',

                  details: assistantGradeScheme.details.map((detail) => ({
                    idGradeSchemeDetail: detail.idGradeSchemeDetail,
                    hasAcademicData: detail.hasAcademicData,
                    percentage: detail.percentage,
                    permissionWeight: detail.permissionWeight ?? 1,

                    order: detail.order,

                    gradeItem: {
                      idGradeItem: detail.gradeItem.idGradeItem,
                    },
                  })),
                }
              : undefined
          }
          onClose={() => setAssistantDialogOpen(false)}
          onSubmit={async (data) => {
            if (assistantGradeScheme) {
              await onUpdateAssistantGradeScheme(assistantGradeScheme.idGradeScheme, data);
            } else {
              await onCreateAssistantGradeScheme(data);
            }

            setAssistantDialogOpen(false);
          }}
        />
      )}

      {isAssistant && selectedGradeSchemeDetailId !== null && (
        <ActivityManagementDialog
          open={activityDialogOpen}
          loading={loadingActivities}
          saving={savingActivity}
          activities={activities}
          gradeItemName={selectedGradeItemName}
          idGradeSchemeDetail={selectedGradeSchemeDetailId}
          onClose={() => {
            setActivityDialogOpen(false);
            setSelectedGradeSchemeDetailId(null);
            setSelectedGradeItemName('');
          }}
          onCreate={createActivityHandler}
          onUpdate={updateActivityHandler}
          onDelete={removeActivityHandler}
        />
      )}
    </Stack>
  );
}
