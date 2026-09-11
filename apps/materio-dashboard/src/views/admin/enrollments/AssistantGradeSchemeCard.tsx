'use client';

import { Button, Card, CardContent, CardHeader, Divider, Stack, Typography } from '@mui/material';

import type { IAssistantGradeScheme } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

interface AssistantGradeSchemeCardProps {
  scheme: IAssistantGradeScheme | null;
  loading: boolean;
  onConfigure: () => void;
  onManageActivities: (idGradeSchemeDetail: number, gradeItemName: string) => void;
}

export function AssistantGradeSchemeCard({
  scheme,
  loading,
  onConfigure,
  onManageActivities,
}: AssistantGradeSchemeCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader title='Evaluación del auxiliar' />
        <CardContent>
          <Typography color='text.secondary'>Cargando configuración...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!scheme) {
    return (
      <Card>
        <CardHeader title='Evaluación del auxiliar' />

        <CardContent>
          <Stack spacing={2}>
            <Typography color='text.secondary'>
              Todavía no has configurado la distribución de tus calificaciones para esta materia.
            </Typography>

            <Button variant='contained' onClick={onConfigure}>
              Configurar evaluación
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader title={scheme.name} subheader='Configuración de evaluación del auxiliar' />

      <CardContent>
        <Stack spacing={2}>
          <Stack direction='row' justifyContent='space-between'>
            <Typography>Porcentaje del auxiliar</Typography>

            <Typography fontWeight={700}>{scheme.assistantPercentage}%</Typography>
          </Stack>

          <Divider />

          {details.map((detail) => (
            <Stack key={detail.idGradeSchemeDetail} spacing={1.5}>
              <Stack direction='row' justifyContent='space-between' alignItems='center'>
                <Typography fontWeight={600}>{detail.gradeItem.name}</Typography>

                <Typography fontWeight={700}>{detail.percentage}%</Typography>
              </Stack>

              <Stack direction='row' justifyContent='space-between' alignItems='center'>
                <Typography variant='body2' color='text.secondary'>
                  {detail.activities.length === 0
                    ? 'Sin actividades'
                    : `${detail.activities.length} ${detail.activities.length === 1 ? 'actividad' : 'actividades'}`}
                </Typography>

                <Button
                  size='small'
                  variant='outlined'
                  onClick={() => onManageActivities(detail.idGradeSchemeDetail, detail.gradeItem.name)}
                >
                  Gestionar actividades
                </Button>
              </Stack>
            </Stack>
          ))}

          <Divider />

          <Stack direction='row' justifyContent='space-between'>
            <Typography fontWeight={700}>Total</Typography>

            <Typography fontWeight={700}>100%</Typography>
          </Stack>

          <Button variant='outlined' onClick={onConfigure}>
            Editar configuración
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
