import React from "react";
import { render, screen } from "@testing-library/react";
import { ClassAverageRow } from "@/components/grades/ClassAverageRow";

const marks = {
  a_bot: 50,
  b_bot: 70,
  a_eot: 40,
  b_eot: null,
};

function renderRow() {
  return render(
    <table>
      <tbody>
        <tr>
          <ClassAverageRow
            marks={marks}
            studentIds={["a", "b"]}
            assessmentTypes={["bot", "eot"]}
            competencyMode={false}
          />
        </tr>
      </tbody>
    </table>,
  );
}

describe("ClassAverageRow", () => {
  it("shows the label, column averages and the class mean", () => {
    renderRow();
    expect(screen.getByText("Class Avg")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("57.5")).toBeInTheDocument();
  });

  it("shows a dash where there are no marks", () => {
    render(
      <table>
        <tbody>
          <tr>
            <ClassAverageRow marks={{}} studentIds={["a"]} assessmentTypes={["bot"]} competencyMode={false} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
