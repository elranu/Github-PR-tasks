import tl = require('azure-pipelines-task-lib/task');
import Octokit = require('@octokit/rest');

const githubEndpoint = tl.getInput('githubEndpoint');
const githubEndpointObject = tl.getEndpointAuthorization(githubEndpoint, true);

const githubRepository = tl.getInput('githubRepository') ? tl.getInput('githubRepository').split('/')
                        : null;

let githubOwner = '';
let repo = '';
let githubEndpointToken= '';

if(githubRepository){
   repo = githubRepository[1];
   githubOwner = githubRepository[0];
}

if (githubEndpointObject && githubEndpointObject.scheme === 'PersonalAccessToken') {
    githubEndpointToken = githubEndpointObject.parameters.accessToken
} else if(githubEndpointObject) {
    // scheme: 'OAuth'
    githubEndpointToken = githubEndpointObject.parameters.AccessToken
}

const finalGithubToken = githubEndpointToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const title = tl.getInput('title');
const body = tl.getInput('body');
const baseBranch = tl.getInput('baseBranch');
const headBranch = githubOwner +':'+ tl.getInput('headBranch');
const upsert = tl.getBoolInput('upsert');

async function run() {
    try {
        const clientWithAuth = new Octokit({
            auth: 'token ' + finalGithubToken
        });
        const listPRResponse = await clientWithAuth.pulls.list({owner:githubOwner, repo: repo, state:'open', head: headBranch, base: baseBranch});

        if(!upsert && listPRResponse.data && listPRResponse.data.length > 0){
            tl.setResult(tl.TaskResult.Failed, 'The Pull request is already created. Pull request number: ' + listPRResponse.data[0].number + '. If you want to avoid this error select the option Upsert.');
            return;
        }

        if(listPRResponse.data && listPRResponse.data.length > 0){
            const result = await clientWithAuth.pulls.update({owner: githubOwner, repo: repo, number: listPRResponse.data[0].number, title: title, body: body, state:'open', base: baseBranch});
            if (result.status >= 200 && result.status < 300 && result.data.number > 0)  {
                tl.setResult(tl.TaskResult.Succeeded, 'Pull request number ' + result.data.number + ' updated');
                tl.setVariable("PULL_REQUEST_ID", result.data.number.toString())
            }
            else
            {
                tl.setResult(tl.TaskResult.Failed, 'Pull request update failed');
            }
        }
        else {
            const result = await clientWithAuth.pulls.create({owner: githubOwner, repo: repo, title: title, head: headBranch, base: baseBranch, body: body});
            if (result.status >= 200 && result.status < 300 && result.data.number > 0)  {
                tl.setResult(tl.TaskResult.Succeeded, 'Pull request number ' + result.data.number + ' created');
                tl.setVariable("PULL_REQUEST_ID", result.data.number.toString())
            }
            else
            {
                tl.setResult(tl.TaskResult.Failed, 'Pull request creation failed');
            }
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
        console.log(err);
    }
}

run();