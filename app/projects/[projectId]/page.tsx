import { ProjectDetailWorkspace } from "@/components/workspaces/project-detail-workspace";

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  return <ProjectDetailWorkspace projectId={params.projectId} />;
}
