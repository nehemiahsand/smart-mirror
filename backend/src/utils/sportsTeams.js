const TEAM_IDS = ['auburn', 'gsw'];
function normalizeSportsPreferences(sports) {
  if (!sports || typeof sports !== 'object' || Array.isArray(sports)) return sports;
  const priority = Array.isArray(sports.livePriority) ? sports.livePriority : [];
  return { ...sports, highlightsTeam: TEAM_IDS.includes(sports.highlightsTeam) ? sports.highlightsTeam : 'gsw',
    livePriority: [...new Set([...priority.filter((id) => TEAM_IDS.includes(id)), ...TEAM_IDS])] };
}
module.exports = { TEAM_IDS, normalizeSportsPreferences };
