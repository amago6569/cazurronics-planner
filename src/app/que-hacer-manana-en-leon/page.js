// /que-hacer-manana-en-leon — los planes de mañana (se actualiza solo cada media hora)
import PaginaDia, { metadataDia } from "../components/PaginaDia";

export const revalidate = 1800;
export const generateMetadata = () => metadataDia(1);
export default function QueHacerManana() { return <PaginaDia offset={1} />; }
