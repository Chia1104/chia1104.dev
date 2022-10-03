describe("H1 Chia1104", () => {
  it("Should return Chia1104 in h1 tag", () => {
    cy.visit("http://localhost:3000/");
    cy.get("h1").should("contain", "Chia1104");
  });
});
