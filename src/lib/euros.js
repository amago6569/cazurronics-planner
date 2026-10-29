// Gasto de la IA en euros. Aviso si un día pasa de 1 € (la regla de Alejandro es parar a los 5 € de golpe; esto avisa
// mucho antes). Sin dependencias: lo usan el servidor y la pantalla de la oficina.
export const LIMITE_DIA_EUROS = 1;
export const euros = (n) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
