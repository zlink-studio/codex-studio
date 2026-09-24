import { ClientDetailWorkspace } from "@/components/workspaces/studio-operations-workspaces";
export default function ClientDetailPage({ params }: { params: { clientKey: string } }) { return <ClientDetailWorkspace clientKey={params.clientKey} />; }
