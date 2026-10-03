import { cache } from "react";
import { notFound } from "next/navigation";
import { leerJSON } from "../../../lib/almacen";
import { idPlanValido } from "../../../lib/votos";
import PlanCompartido from "../../components/PlanCompartido";

export const dynamic = "force-dynamic";

// Con cache(), el título (generateMetadata) y la página comparten UNA sola lectura del plan por visita
const leerPlan = cache((id) => (idPlanValido(id) ? leerJSON(`plan:${id}`) : null));

async function cargarPlan(params) {
  const { id } = await params;
  return leerPlan(id);
}

const fechaLarga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

// Título y descripción que se ven al pegar el enlace en WhatsApp, Instagram o Telegram
export async function generateMetadata({ params }) {
  const plan = await cargarPlan(params);
  if (!plan) return { title: "Plan no encontrado · Cazurronics Planner" };
  const paradas = plan.itinerario.map((p) => p.titulo);
  return {
    title: `Plan en ${plan.zona || "León"} para el ${fechaLarga(plan.fecha)} · Cazurronics`,
    description: `${paradas.slice(0, 4).join(" → ")}. Entra y vota las paradas con tu grupo.`,
    openGraph: { type: "website", siteName: "Cazurronics Planner", locale: "es_ES" },
    robots: { index: false }, // los planes son personales: fuera de Google
  };
}

export default async function PaginaPlan({ params }) {
  const plan = await cargarPlan(params);
  if (!plan) notFound();
  return <PlanCompartido inicial={plan} />;
}
