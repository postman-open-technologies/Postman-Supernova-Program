const core = require('@actions/core');
const github = require('@actions/github');
const { promises: fs } = require('fs');

async function run() {
  try {
    // Get inputs from workflow
    const payload = github.context.payload;
    const contributionName = payload.inputs.contribution_name;
    const contributionUrl = payload.inputs.contribution_url;
    const contributionAuthor = payload.inputs.contribution_author;
    let contributionDate = new Date(payload.inputs.contribution_date);

    // Log Inputs
    console.log(`Contribution Name: ${contributionName}`);
    console.log(`Contribution URL: ${contributionUrl}`);
    console.log(`Contribution Author: ${contributionAuthor}`);
    console.log(`Contribution Date: ${contributionDate}`);

    // Format the date as "MMM. Dth"
    const nth = (d) => {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };

    // Format inputted date correctly (MMM. Dth)
    const formattedDate = contributionDate.toLocaleString("default", { month: "short" }) + ". " + contributionDate.getDate() + nth(contributionDate.getDate());

    // Format our new entry correctly
    const newEntry = `- ${formattedDate}: [${contributionName}](${contributionUrl}) by ${contributionAuthor}`;
    console.log("New Entry" + newEntry + "\n");

    // Read in file
    const filePath = "pages/contributions/Current-Contributions.md";
    const fileContent = await fs.readFile(filePath, "utf8");

    // Find current year's header
    const yearHeaderIndex = fileContent.indexOf(`## ${contributionDate.getFullYear()}`);
    if (yearHeaderIndex === -1) return console.log("Year not found.");

    // Get index of previous year's header
    const lastYearIndex = fileContent.indexOf(`## ${contributionDate.getFullYear() - 1}`);
    // TODO: ^^ This errors if there is no previous year.

    // Split text to then parse through for correct month
    const firstNewLineIndex = fileContent.indexOf("\n", yearHeaderIndex);
    const lastNewLineIndex = fileContent.lastIndexOf("\n", lastYearIndex);

    const contributions = fileContent
      .substring(firstNewLineIndex + 1, lastNewLineIndex)
      .split("\n");

    // If empty, insert at top
    if (contributions.length === 1) {
      console.log(`No contributions this month, pushing...`);
      contributions.splice(1, 0, newEntry);
    } else {
      console.log("Searching for correct position to insert new data...")
      // Find correct place to insert
      let found = false;
      let index = -1;

      while (!found) {
        index++;
        const contribution = contributions[index];

        if (contribution.length === 0) return; // New line/null situations

        // Get DATE part of string -- "- Mar. 24th: [EVENT NAME](URL) by AUTHOR"
        const dateStr = contribution.substring(2, contribution.indexOf(":"));
        // We can infer the year due to how we are inserting this data.
        // Appending year is important for the proper date calculation.
        const date = Date.parse(`${dateStr.slice(0, -2)}, ${contributionDate.getFullYear()}`);

        // Insert at first instance of date being older than new entry
        if (date > contributionDate) {
          console.log(`Found index in current month ${index}, pushing...`);
          found = true;
          contributions.splice(index, 0, newEntry);
        } else if (index === contributions.length - 2) {
          // Or at end of array as it would be the oldest item
          console.log(`Oldest date, adding to end of list...`);
          found = true;
          contributions.splice(index + 1, 0, newEntry);
        }
      }
    }
    // Write our contributions to file in correct location.
    const newFileContents = fileContent.substring(0, firstNewLineIndex) + "\n" + contributions.join("\n") + fileContent.substring(lastNewLineIndex);

    console.log("------");
    console.log("New Contents:");
    console.log(newFileContents);
    console.log("Contributions Data:");
    console.log(contributions);

    // Commit the changes
    const accessToken = process.env.PERSONAL_ACCESS_TOKEN;
    const octokit = github.getOctokit(accessToken);
    console.log(`Access Token: ${accessToken}`);
    console.log(octokit.repos);

    const { data: { sha: currentSha } } = await octokit.rest.repos.getContent({
      owner: "postman-open-technologies",
      repo: "Postman-Supernova-Program",
      path: filePath,
      ref: "main"
    });

    const commit = await octokit.rest.repos.createOrUpdateFileContents({
      owner: "postman-open-technologies",
      repo: "Postman-Supernova-Program",
      path: filePath,
      message: `New contribution: ${contributionName} by ${contributionAuthor}`,
      committer: {
        name: "Kevin Corbett",
        email: "kevin.corbett08@gmail.com"
      },
      content: Buffer.from(newFileContents).toString('base64'),
      branch: 'main',
      sha: currentSha,
    });

    console.log(`Changes committed: ${commit.data.commit.html_url}`);
  } catch (error) {
    console.error(error);
    core.setFailed(error.message);
  }
}

run();
