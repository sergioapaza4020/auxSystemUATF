'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Box, Grid, Stack } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import { UserRole } from '@/enums/userRole';

import { EnrollmentHeader } from './EnrollmentHeader';
import { GradeSchemeCard } from './GradeSchemeCard';
import { GradesCard } from './GradesCard';
import { EnrollmentStudentsCard } from './EnrollmentStudentsCard';
import type {
  IAssistantGradeScheme,
  IAssistantGradeSchemeCreate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';
import { AssistantGradeSchemeCard } from './AssistantGradeSchemeCard';
import { useGradeItems } from '@/hooks/grade-items';
import { AssistantGradeSchemeDialog } from './AssistantGradeSchemeDialog';
import { useActivities } from '@/hooks/activities/useActivities';
import { ActivityManagementDialog } from './ActivityManagementDialog';

interface EnrollmentDetailProps {
  enrollment: IEnrollment;
  grades: IGrade[];
  students: IEnrollmentStudent[];
  loading: boolean;
  loadingStudents: boolean;

  assistantGradeScheme: IAssistantGradeScheme | null;
  loadingAssistantGradeScheme: boolean;
  savingAssistantGradeScheme: boolean;

  onCreateAssistantGradeScheme: (data: IAssistantGradeSchemeCreate) => Promise<IAssistantGradeScheme>;

  onUpdateAssistantGradeScheme: (
    idAssistantGradeScheme: number,
    data: IAssistantGradeSchemeCreate,
  ) => Promise<IAssistantGradeScheme>;
}

export function EnrollmentDetail(props: EnrollmentDetailProps) {
  const {
    enrollment,
    grades,
    students,
    loading,
    loadingStudents,
    assistantGradeScheme,
    loadingAssistantGradeScheme,
    savingAssistantGradeScheme,
    onCreateAssistantGradeScheme,
    onUpdateAssistantGradeScheme,
  } = props;

  const router = useRouter();

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
  } = useActivities(selectedGradeSchemeDetailId, enrollment.course.idCourse);

  const isAssistant = enrollment.role === UserRole.ASSISTANT;

  return (
    <Box>
      <EnrollmentHeader enrollment={enrollment} />

      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <GradeSchemeCard enrollment={enrollment} />
        </Grid>

        <Grid item xs={12} md={6}>
          {isAssistant ? (
            <Stack>
              <AssistantGradeSchemeCard
                scheme={assistantGradeScheme}
                loading={loadingAssistantGradeScheme}
                onConfigure={() => {
                  setAssistantDialogOpen(true);
                }}
                onManageActivities={(idGradeSchemeDetail, gradeItemName) => {
                  setSelectedGradeSchemeDetailId(idGradeSchemeDetail);

                  setSelectedGradeItemName(gradeItemName);

                  setActivityDialogOpen(true);
                }}
              />

              <EnrollmentStudentsCard
                students={students}
                loading={loadingStudents}
                onSelectStudent={(student) => {
                  router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/students/${student.idEnrollment}`);
                }}
              />
            </Stack>
          ) : (
            <GradesCard enrollment={enrollment} grades={grades} loading={loading} />
          )}
        </Grid>
      </Grid>

      {isAssistant && (
        <AssistantGradeSchemeDialog
          open={assistantDialogOpen}
          loading={savingAssistantGradeScheme}
          gradeItems={gradeItems}
          loadingGradeItems={loadingGradeItems}
          initialValue={
            assistantGradeScheme
              ? {
                  assistantPercentage: assistantGradeScheme.assistantPercentage,

                  name: assistantGradeScheme.name,

                  description: assistantGradeScheme.description ?? '',

                  details: assistantGradeScheme.details.map((detail) => ({
                    percentage: detail.percentage,
                    order: detail.order,
                    gradeItem: {
                      idGradeItem: detail.gradeItem.idGradeItem,
                    },
                  })),
                }
              : undefined
          }
          onClose={() => {
            setAssistantDialogOpen(false);
          }}
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
    </Box>
  );
}
