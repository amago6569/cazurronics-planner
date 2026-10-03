// /que-hacer-hoy-en-leon — los planes de hoy (se actualiza solo cada media hora)
import PaginaDia, { metadataDia } from "../components/PaginaDia";

export const revalidate = 1800;
export const generateMetadata = () => metadataDia(0);
export default function QueHacerHoy() { return <PaginaDia offset={0} />; }
