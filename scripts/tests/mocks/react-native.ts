export let currentScheme: 'light' | 'dark' | null | undefined = 'light';
export const useColorScheme = () => currentScheme;
export function setScheme(s: any) { currentScheme = s; }
