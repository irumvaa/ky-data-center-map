/**
 * KY Data Center Map, Form builder
 * ==================================
 * Run `createForm()` ONCE from the Apps Script editor (select it from the
 * function dropdown at the top, then click Run). It builds the entire
 * branching intake form for you. After it runs, check the Execution Log
 * for the form's edit URL and public URL, open the edit URL to review it,
 * then link its responses to your Sheet (Form > Responses tab > click the
 * green Sheets icon > select the same Sheet SHEET_ID points to in Code.gs).
 *
 * Note: this creates a NEW form every time you run it. If you need to
 * rebuild it, delete the old one from Google Drive first, or you'll end up
 * with duplicates.
 */

function createForm() {
  const form = FormApp.create('KY Data Center Map, Add or Report Information')
    .setDescription(
      'Use this form to add a new data center project or regulation to the ' +
      'map, or to report a correction to something already on it.'
    )
    .setConfirmationMessage('Thanks, your submission has been received. It will be reviewed before it appears on the map.')
    .setAllowResponseEdits(false)
    .setCollectEmail(false);

  // The router page and question go first, together, since the question
  // needs to live on this page, not just be created before other pages.
  form.addPageBreakItem().setTitle('What would you like to do?');
  const router = form.addMultipleChoiceItem()
    .setTitle('What would you like to do?')
    .setRequired(true);

  // Each branch below is: create its page break, add its fields right
  // there (not batched elsewhere), then explicitly send it to the Thank
  // You page so it doesn't fall through into the next branch's page.
  // The router's choices are set at the very end, once every page break
  // object actually exists to point at.

  // ================= ADD A NEW REGULATION =================
  const regPage = form.addPageBreakItem().setTitle('Add a new Regulation');
  form.addTextItem().setTitle('County').setRequired(true);
  form.addTextItem().setTitle('City (optional)');
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
  form.addTextItem().setTitle('Address (optional)')
    .setHelpText('Only if this is tied to a specific site, not usually needed for a regulation.');
  form.addParagraphTextItem().setTitle('Source(s), one or more links')
    .setHelpText('Paste one link per line, or separate with commas. No limit on how many.')
    .setRequired(true);
  form.addParagraphTextItem().setTitle('Notes')
    .setHelpText('Anything else worth knowing. Write as much as you need, there is no length limit.');

  // ================= ADD A NEW PROJECT =================
  const projPage = form.addPageBreakItem().setTitle('Add a new Project');
  form.addTextItem().setTitle('Project name').setRequired(true);
  form.addTextItem().setTitle('County').setRequired(true);
  form.addTextItem().setTitle('City (optional)');
  form.addTextItem().setTitle('Address (optional)')
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
  form.addParagraphTextItem().setTitle('Source(s), one or more links')
    .setHelpText('Paste one link per line, or separate with commas. No limit on how many.')
    .setRequired(true);
  form.addParagraphTextItem().setTitle('Notes')
    .setHelpText('Write as much as you need, there is no length limit.');

  // ================= REPORT A CHANGE (3 separate pages, same 4 fields each) =================
  const regChangePage = form.addPageBreakItem().setTitle('Report a change to a Regulation');
  addChangeReportFields(form);

  const projChangePage = form.addPageBreakItem().setTitle('Report a change to a Project');
  addChangeReportFields(form);

  const dcChangePage = form.addPageBreakItem().setTitle(
    'Report a change to a DC from datacentermap.com facility'
  );
  addChangeReportFields(form);

  const endPage = form.addPageBreakItem().setTitle('Thank you');

  // Now that every page break actually exists (each created immediately
  // before its own content, in the order a respondent would move through
  // them), point the router at the real ones, and make each branch jump
  // straight to Thank You when it's done rather than falling through into
  // the next branch's questions.
  router.setChoices([
    router.createChoice('Add a new Regulation (a moratorium, ordinance, or pending legislation not yet on the map)', regPage),
    router.createChoice('Add a new Project (a data center project not yet on the map)', projPage),
    router.createChoice('Report a change to a Regulation (something already on the map needs correcting)', regChangePage),
    router.createChoice('Report a change to a Project (something already on the map needs correcting)', projChangePage),
    router.createChoice('Report a change to a DC from datacentermap.com facility (a general hosting/colocation listing, not a tracked project)', dcChangePage),
  ]);
  regPage.setGoToPage(endPage);
  projPage.setGoToPage(endPage);
  regChangePage.setGoToPage(endPage);
  projChangePage.setGoToPage(endPage);
  dcChangePage.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  Logger.log('Form created.');
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
