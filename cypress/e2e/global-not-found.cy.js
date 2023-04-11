describe("Global 404", () => {
  it("Should return 404 page", () => {
    cy.visit("http://localhost:3000/404");
    cy.get("h1").should("contain", "404");
  });
  it("Should go back to home page", () => {
    cy.visit("http://localhost:3000/404");
    cy.get("h1").should("contain", "404");
    cy.get("a").click();
    cy.url().should("eq", "http://localhost:3000/");
  });
});
