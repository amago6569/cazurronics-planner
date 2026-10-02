// Atmósfera común: la ilustración de León desenfocada + manchas de color de vidriera (estática)
export default function Fondo() {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-30 bg-[#fdf6ef]" />
      <div aria-hidden className="fixed inset-0 -z-20 bg-[url('/fondo.jpg')] bg-cover bg-center scale-110 blur-xl opacity-90 saturate-150" />
      <div aria-hidden className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[55vw] h-[55vw] max-w-[640px] max-h-[640px] rounded-full bg-rose-300/40 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-sky-300/35 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-[45vw] h-[45vw] max-w-[520px] max-h-[520px] rounded-full bg-amber-200/45 blur-3xl" />
      </div>
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-white/35 via-white/10 to-white/45 pointer-events-none" />
    </>
  );
}
