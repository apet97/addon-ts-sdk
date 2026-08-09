import { applyClockifyLanguage, applyClockifyTheme, isClockifyAdminRole } from "../../src/ui";

applyClockifyTheme("DARK", document.documentElement);
applyClockifyLanguage("EN", document.documentElement);
isClockifyAdminRole("ADMIN");
