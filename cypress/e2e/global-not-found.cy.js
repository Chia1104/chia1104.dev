describe("Global 404", () => {
  it("Should return 404 page", () => {
    cy.visit("http://localhost:3000/404");
    cy.get("h2").should("contain", "404");
  });
  it("Should go back to home page, and return Chia1104 in h1 tag", () => {
    cy.visit("http://localhost:3000/404");
    cy.get("h2").should("contain", "404");
    cy.get("a").click();
    cy.url().should("eq", "http://localhost:3000/");
    cy.get("h1").should("contain", "Chia1104");
  });
});
