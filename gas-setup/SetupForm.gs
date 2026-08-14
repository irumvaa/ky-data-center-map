/**
 * KY Data Center Map, Form builder
 * ==================================
 * Builds TWO separate forms, run each once from the Apps Script editor
 * (select the function from the dropdown, click Run):
 *
 *   - `createAddForm()` builds the "Add new information" form (2 branches:
 *     a new Regulation, or a new Project).
 *   - `createReportForm()` builds the "Report a problem" form (3 branches:
 *     a correction to an existing Regulation, Project, or DC facility).
 *
 * They're kept separate on purpose, adding something new and reporting a
 * problem with something already on the map are different enough tasks
 * that mixing them into one long branching form made the first question
 * ("what would you like to do?") do too much work.
 *
 * After each runs, check the Execution Log for that form's edit URL and
 * public URL, open the edit URL to review it, then link its responses to
 * your Sheet (Form > Responses tab > click the green Sheets icon > select
 * the same Sheet SHEET_ID points to in Code.gs). Both forms link to the
 * SAME Sheet, they just write to different places depending on what's
 * submitted.
 *
 * Note: each function creates a NEW form every time it's run. If you need
 * to rebuild one, delete the old one from Google Drive first, or you'll
 * end up with duplicates.
 */

function createAddForm() {
  const form = FormApp.create('KY Data Center Map, Add New Information')
    .setDescription(
      'Use this form to add a new data center project or regulation that ' +
      'is not yet on the map.'
    )
    .setConfirmationMessage('Thanks, your submission has been received. It will be reviewed before it appears on the map.')
    .setAllowResponseEdits(false)
    .setCollectEmail(false);

  form.addPageBreakItem().setTitle('What would you like to add?');
  const router = form.addMultipleChoiceItem()
    .setTitle('What would you like to add?')
    .setRequired(true);

  // ================= ADD A NEW REGULATION =================
  const regPage = form.addPageBreakItem().setTitle('Add a new Regulation');
  form.addTextItem().setTitle('County (for a Regulation)').setRequired(true);
  form.addTextItem().setTitle('City (optional, for a Regulation)');
  form.addMultipleChoiceItem()
    .setTitle('Is this county-wide, or specific to one city within the county?')
    .setChoiceValues(['County-wide', 'City-level (one city only)'])
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle('Type')
    .setChoiceValues(['Moratorium', 'Ordinance', 'Pending/Proposed'])
    .setRequired(true);
  form.addDateItem().setTitle('Start date').setRequired(false);
  form.addTextItem().setTitle('Duration')
    .setHelpText('e.g. "1 year", "180 days", "permanent", however it was described.');
  form.addDateItem().setTitle('Expiration date (if known)');
  form.addTextItem().setTitle('Address (optional, for a Regulation)')
    .setHelpText('Only if this is tied to a specific site, not usually needed for a regulation.');
  form.addParagraphTextItem().setTitle('Source(s), one or more links (for a Regulation)')
    .setHelpText('Paste one link per line, or separate with commas. No limit on how many.')
    .setRequired(true);
  form.addParagraphTextItem().setTitle('Notes (for a Regulation)')
    .setHelpText('Anything else worth knowing. Write as much as you need, there is no length limit.');

  // ================= ADD A NEW PROJECT =================
  const projPage = form.addPageBreakItem().setTitle('Add a new Project');
  form.addTextItem().setTitle('Project name').setRequired(true);
  form.addTextItem().setTitle('County (for a Project)').setRequired(true);
  form.addTextItem().setTitle('City (optional, for a Project)');
  form.addTextItem().setTitle('Address (optional, for a Project)')
    .setHelpText('If you know the exact site. Leave blank if you only know the county, the pin will be placed at the county center in that case.');
  form.addTextItem().setTitle('Google Maps link (optional)')
    .setHelpText('An alternative to typing the address, paste a Google Maps link and we\'ll use its coordinates. Use the full link, not a shortened goo.gl one.');
  form.addParagraphTextItem().setTitle('Size/Capacity')
    .setHelpText('MW, GW, square footage, acreage, whatever is known. No length limit.');
  form.addTextItem().setTitle('Developer');
  form.addParagraphTextItem().setTitle('Planning & zoning status')
    .setHelpText('No length limit.');
  form.addTextItem().setTitle('Utility status')
    .setHelpText('e.g. "TSR - Applied", "ESA - Approved" if known.');
  form.addParagraphTextItem().setTitle('Tariff')
    .setHelpText('No length limit.');
  form.addMultipleChoiceItem()
    .setTitle('Stage')
    .setChoiceValues(['Rumored', 'Proposed', 'Operating'])
    .setRequired(true);
  form.addTextItem().setTitle('Estimated completion date');
  form.addTextItem().setTitle('Tenant');
  form.addParagraphTextItem().setTitle('Source(s), one or more links (for a Project)')
    .setHelpText('Paste one link per line, or separate with commas. No limit on how many.')
    .setRequired(true);
  form.addParagraphTextItem().setTitle('Notes (for a Project)')
    .setHelpText('Write as much as you need, there is no length limit.');

  const endPage = form.addPageBreakItem().setTitle('Thank you');

  router.setChoices([
    router.createChoice('A new Regulation (a moratorium, ordinance, or pending legislation not yet on the map)', regPage),
    router.createChoice('A new Project (a data center project not yet on the map)', projPage),
  ]);
  regPage.setGoToPage(endPage);
  projPage.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  Logger.log('Add form created.');
  Logger.log('Edit URL: ' + form.getEditUrl());
  Logger.log('Public URL: ' + form.getPublishedUrl());
}

function createReportForm() {
  const form = FormApp.create('KY Data Center Map, Report a Problem')
    .setDescription(
      'Use this form to report something that needs correcting on ' +
      'something already on the map, a regulation, a project, or a ' +
      'DC from datacentermap.com listing.'
    )
    .setConfirmationMessage('Thanks, your report has been received and will be reviewed.')
    .setAllowResponseEdits(false)
    .setCollectEmail(false);

  form.addPageBreakItem().setTitle('What would you like to report a change to?');
  const router = form.addMultipleChoiceItem()
    .setTitle('What would you like to report a change to?')
    .setRequired(true);

  const regChangePage = form.addPageBreakItem().setTitle('Report a change to a Regulation');
  addChangeReportFields(form);

  const projChangePage = form.addPageBreakItem().setTitle('Report a change to a Project');
  addChangeReportFields(form);

  const dcChangePage = form.addPageBreakItem().setTitle(
    'Report a change to a DC from datacentermap.com facility'
  );
  addChangeReportFields(form);

  const endPage = form.addPageBreakItem().setTitle('Thank you');

  router.setChoices([
    router.createChoice('A Regulation (something already on the map needs correcting)', regChangePage),
    router.createChoice('A Project (something already on the map needs correcting)', projChangePage),
    router.createChoice('A DC from datacentermap.com facility (a general hosting/colocation listing, not a tracked project)', dcChangePage),
  ]);
  regChangePage.setGoToPage(endPage);
  projChangePage.setGoToPage(endPage);
  dcChangePage.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  Logger.log('Report form created.');
  Logger.log('Edit URL: ' + form.getEditUrl());
  Logger.log('Public URL: ' + form.getPublishedUrl());
}

/**
 * The 4 fields shared by all 3 "report a change" branches. Called 3
 * separate times (once per branch) so each branch gets its own distinct
 * set of question items, an Item in a Google Form can only live on the
 * one page it was created on, so these can't be created once and reused.
 */
function addChangeReportFields(form) {
  form.addTextItem().setTitle('Which one? (name or county)').setRequired(true);
  form.addParagraphTextItem().setTitle('What needs to change?')
    .setHelpText('No length limit.')
    .setRequired(true);
  form.addParagraphTextItem().setTitle('Source for this correction')
    .setHelpText('A link supporting the change, if you have one.');
  form.addTextItem().setTitle('Your email (optional, in case we have questions)');
}
