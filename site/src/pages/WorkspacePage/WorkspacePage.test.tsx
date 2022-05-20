import { fireEvent, screen, waitFor } from "@testing-library/react"
import { rest } from "msw"
import React from "react"
import * as api from "../../api/api"
import { Workspace } from "../../api/typesGenerated"
import { Language } from "../../components/WorkspaceActions/WorkspaceActions"
import {
  MockBuilds,
  MockCancelingWorkspace,
  MockDeletedWorkspace,
  MockDeletingWorkspace,
  MockFailedWorkspace,
  MockOutdatedWorkspace,
  MockStartingWorkspace,
  MockStoppedWorkspace,
  MockStoppingWorkspace,
  MockTemplate,
  MockWorkspace,
  MockWorkspaceBuild,
  renderWithAuth,
} from "../../testHelpers/renderHelpers"
import { server } from "../../testHelpers/server"
import { DisplayStatusLanguage } from "../../util/workspace"
import { WorkspacePage } from "./WorkspacePage"

// It renders the workspace page and waits for it be loaded
const renderWorkspacePage = async () => {
  renderWithAuth(<WorkspacePage />, { route: `/workspaces/${MockWorkspace.id}`, path: "/workspaces/:workspace" })
  await screen.findByText(MockWorkspace.name)
}

/**
 * Requests and responses related to workspace status are unrelated, so we can't test in the usual way.
 * Instead, test that button clicks produce the correct requests and that responses produce the correct UI.
 * We don't need to test the UI exhaustively because Storybook does that; just enough to prove that the
 * workspaceStatus was calculated correctly.
 */

const testButton = async (label: string, actionMock: jest.SpyInstance) => {
  await renderWorkspacePage()
  const button = await screen.findByText(label)
  await waitFor(() => fireEvent.click(button))
  expect(actionMock).toBeCalled()
}

const testStatus = async (mock: Workspace, label: string) => {
  server.use(
    rest.get(`/api/v2/workspaces/${MockWorkspace.id}`, (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(mock))
    }),
  )
  await renderWorkspacePage()
  const status = await screen.findByRole("status")
  expect(status).toHaveTextContent(label)
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe("Workspace Page", () => {
  it("shows a workspace", async () => {
    await renderWorkspacePage()
    const workspaceName = screen.getByText(MockWorkspace.name)
    expect(workspaceName).toBeDefined()
  })
  it("shows the status of the workspace", async () => {
    await renderWorkspacePage()
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Running")
  })
  it("requests a stop job when the user presses Stop", async () => {
    const stopWorkspaceMock = jest.spyOn(api, "stopWorkspace").mockResolvedValueOnce(MockWorkspaceBuild)
    await testButton(Language.stop, stopWorkspaceMock)
  })
  it("requests a start job when the user presses Start", async () => {
    server.use(
      rest.get(`/api/v2/workspaces/${MockWorkspace.id}`, (req, res, ctx) => {
        return res(ctx.status(200), ctx.json(MockStoppedWorkspace))
      }),
    )
    const startWorkspaceMock = jest
      .spyOn(api, "startWorkspace")
      .mockImplementation(() => Promise.resolve(MockWorkspaceBuild))
    await testButton(Language.start, startWorkspaceMock)
  })
  it("requests a start job when the user presses Retry after trying to start", async () => {
    // Use a workspace that failed during start
    server.use(
      rest.get(`/api/v2/workspaces/${MockWorkspace.id}`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ...MockFailedWorkspace,
            latest_build: {
              ...MockFailedWorkspace.latest_build,
              transition: "start",
            },
          }),
        )
      }),
    )
    const startWorkSpaceMock = jest.spyOn(api, "startWorkspace").mockResolvedValueOnce(MockWorkspaceBuild)
    await testButton(Language.retry, startWorkSpaceMock)
  })
  it("requests a stop job when the user presses Retry after trying to stop", async () => {
    // Use a workspace that failed during stop
    server.use(
      rest.get(`/api/v2/workspaces/${MockWorkspace.id}`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            ...MockFailedWorkspace,
            latest_build: {
              ...MockFailedWorkspace.latest_build,
              transition: "stop",
            },
          }),
        )
      }),
    )
    const stopWorkspaceMock = jest
      .spyOn(api, "stopWorkspace")
      .mockImplementation(() => Promise.resolve(MockWorkspaceBuild))
    await testButton(Language.retry, stopWorkspaceMock)
  })
  it("requests a template when the user presses Update", async () => {
    const getTemplateMock = jest.spyOn(api, "getTemplate").mockResolvedValueOnce(MockTemplate)
    server.use(
      rest.get(`/api/v2/workspaces/${MockWorkspace.id}`, (req, res, ctx) => {
        return res(ctx.status(200), ctx.json(MockOutdatedWorkspace))
      }),
    )
    await testButton(Language.update, getTemplateMock)
  })
  it("shows the Stopping status when the workspace is stopping", async () => {
    await testStatus(MockStoppingWorkspace, DisplayStatusLanguage.stopping)
  })
  it("shows the Stopped status when the workspace is stopped", async () => {
    await testStatus(MockStoppedWorkspace, DisplayStatusLanguage.stopped)
  })
  it("shows the Building status when the workspace is starting", async () => {
    await testStatus(MockStartingWorkspace, DisplayStatusLanguage.starting)
  })
  it("shows the Running status when the workspace is started", async () => {
    await testStatus(MockWorkspace, DisplayStatusLanguage.started)
  })
  it("shows the Failed status when the workspace is failed or canceled", async () => {
    await testStatus(MockFailedWorkspace, DisplayStatusLanguage.failed)
  })
  it("shows the Canceling status when the workspace is canceling", async () => {
    await testStatus(MockCancelingWorkspace, DisplayStatusLanguage.canceling)
  })
  it("shows the Deleting status when the workspace is deleting", async () => {
    await testStatus(MockDeletingWorkspace, DisplayStatusLanguage.deleting)
  })
  it("shows the Deleted status when the workspace is deleted", async () => {
    await testStatus(MockDeletedWorkspace, DisplayStatusLanguage.deleted)
  })
  it("shows the timeline build", async () => {
    await renderWorkspacePage()
    const table = await screen.findByRole("table")
    const rows = table.querySelectorAll("tbody > tr")
    expect(rows).toHaveLength(MockBuilds.length)
  })
})
