Based on the codebase analysis, here's a detailed implementation plan for merging class and curriculum activities:

1. **Update Activity Types and Interfaces** (in `/types/class-activity.ts`):
```typescript
// Unified Activity Interface
export interface UnifiedActivity {
  id: string;
  title: string;
  description?: string;
  type: ActivityType;
  status: ActivityStatus;
  configuration: ActivityConfiguration;
  
  // Curriculum Integration
  curriculumNodeId?: string;
  isTemplate: boolean; // true for curriculum activities, false for class-specific
  
  // Class Implementation
  classId?: string;
  subjectId: string;
  
  // Grading
  gradingConfig?: {
    isGraded: boolean;
    totalMarks?: number;
    passingMarks?: number;
    gradingType: ActivityGradingType;
  };
  
  resources?: ActivityResource[];
  submissions?: ActivitySubmission[];
  
  // Tracking
  createdAt: Date;
  updatedAt: Date;
}
```

2. **Update Database Schema** (Prisma schema):
```prisma
model Activity {
  id              String   @id @default(cuid())
  title           String
  description     String?
  type            ActivityType
  status          ActivityStatus
  configuration   Json
  isTemplate      Boolean @default(false)
  
  // Relations
  curriculumNode  CurriculumNode? @relation(fields: [curriculumNodeId], references: [id])
  curriculumNodeId String?
  class           Class?    @relation(fields: [classId], references: [id])
  classId         String?
  subject         Subject   @relation(fields: [subjectId], references: [id])
  subjectId       String
  
  // Grading
  gradingConfig   Json?
  resources       ActivityResource[]
  submissions     ActivitySubmission[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

3. **Update Activity Router** (in `/server/api/routers/class-activity.ts`):
```typescript
export const activityRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      type: z.nativeEnum(ActivityType),
      configuration: activityConfigurationSchema,
      isTemplate: z.boolean(),
      curriculumNodeId: z.string().optional(),
      classId: z.string().optional(),
      subjectId: z.string(),
      gradingConfig: gradingConfigSchema.optional(),
      resources: z.array(resourceSchema).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.activity.create({
        data: {
          ...input,
          status: ActivityStatus.DRAFT
        },
        include: {
          curriculumNode: true,
          class: true,
          subject: true,
          resources: true
        }
      });
    }),

  // Add methods for fetching activities with filters
  getAll: protectedProcedure
    .input(z.object({
      classId: z.string().optional(),
      curriculumNodeId: z.string().optional(),
      subjectId: z.string().optional(),
      isTemplate: z.boolean().optional(),
      search: z.string().optional()
    }))
    .query(({ ctx, input }) => {
      const where = {
        ...(input.classId && { classId: input.classId }),
        ...(input.curriculumNodeId && { curriculumNodeId: input.curriculumNodeId }),
        ...(input.subjectId && { subjectId: input.subjectId }),
        ...(typeof input.isTemplate === 'boolean' && { isTemplate: input.isTemplate }),
        ...(input.search && {
          OR: [
            { title: { contains: input.search, mode: 'insensitive' } },
            { description: { contains: input.search, mode: 'insensitive' } }
          ]
        })
      };

      return ctx.prisma.activity.findMany({
        where,
        include: {
          curriculumNode: true,
          class: true,
          subject: true,
          resources: true
        }
      });
    })
});
```

4. **Update CurriculumManager Component** (in `/components/dashboard/roles/super-admin/subject/curriculum/CurriculumManager.tsx`):
```typescript
export function CurriculumManager({ subjectId }: { subjectId: string }) {
  const [selectedNode, setSelectedNode] = useState<CurriculumNode | null>(null);
  
  // Fetch activities for selected node
  const { data: activities } = api.activity.getAll.useQuery(
    { 
      curriculumNodeId: selectedNode?.id,
      isTemplate: true 
    },
    { enabled: !!selectedNode }
  );

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-3">
        <CurriculumTree 
          subjectId={subjectId}
          onNodeSelect={setSelectedNode}
        />
      </div>
      <div className="col-span-9">
        {selectedNode && (
          <UnifiedActivityManager
            nodeId={selectedNode.id}
            isTemplate={true}
            subjectId={subjectId}
          />
        )}
      </div>
    </div>
  );
}
```

5. **Create UnifiedActivityManager Component**:
```typescript
export function UnifiedActivityManager({
  nodeId,
  classId,
  isTemplate,
  subjectId
}: {
  nodeId?: string;
  classId?: string;
  isTemplate: boolean;
  subjectId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const { data: activities } = api.activity.getAll.useQuery({
    curriculumNodeId: nodeId,
    classId,
    isTemplate,
    subjectId
  });

  const createMutation = api.activity.create.useMutation({
    onSuccess: () => {
      setShowForm(false);
      utils.activity.getAll.invalidate();
    }
  });

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2>Activities</h2>
        <Button onClick={() => setShowForm(true)}>
          Create Activity
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {activities?.map(activity => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onEdit={() => setSelectedActivity(activity.id)}
          />
        ))}
      </div>

      {showForm && (
        <ActivityForm
          nodeId={nodeId}
          classId={classId}
          isTemplate={isTemplate}
          subjectId={subjectId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
```

6. **Update GradeBookService** (in `/server/services/GradeBookService.ts`):
```typescript
export class GradeBookService {
  async recordActivityGrade(data: ActivityGrade): Promise<void> {
    const activity = await this.db.activity.findUnique({
      where: { id: data.activityId },
      include: { gradingConfig: true }
    });

    if (!activity?.gradingConfig?.isGraded) {
      throw new Error("Activity is not gradeable");
    }

    await this.db.activitySubmission.upsert({
      where: {
        activityId_studentId: {
          activityId: data.activityId,
          studentId: data.studentId
        }
      },
      create: {
        activityId: data.activityId,
        studentId: data.studentId,
        obtainedMarks: data.grade,
        status: ActivitySubmissionStatus.GRADED
      },
      update: {
        obtainedMarks: data.grade,
        status: ActivitySubmissionStatus.GRADED
      }
    });
  }
}
```

This implementation:
1. Creates a unified activity structure that works for both curriculum and class activities
2. Maintains existing functionality while adding new capabilities
3. Provides clear separation between template activities and class implementations
4. Ensures proper grading integration
5. Supports efficient querying and filtering of activities

The migration process would involve:
1. Creating new database tables
2. Migrating existing activities to the new structure
3. Updating frontend components to use the new unified system
4. Testing thoroughly to ensure no functionality is lost

Would you like me to elaborate on any specific part of this implementation?