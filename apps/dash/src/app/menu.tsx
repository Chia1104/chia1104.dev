"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
} from "@nextui-org/react";

const Menu = () => {
  return (
    <Navbar>
      <NavbarBrand>
        <p className="hidden font-bold text-inherit sm:block">ACME</p>
      </NavbarBrand>
      <NavbarContent className="hidden md:flex">
        <NavbarItem as={Link} color="foreground" href="#">
          Features
        </NavbarItem>
        <NavbarItem isActive as={Link} href="#">
          Customers
        </NavbarItem>
        <NavbarItem as={Link} color="foreground" href="#">
          Integrations
        </NavbarItem>
        <NavbarItem as={Link} color="foreground" href="#">
          Pricing
        </NavbarItem>
        <NavbarItem
          as={Link}
          className="hidden lg:block"
          color="foreground"
          href="#">
          Company
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem as={Link} href="#">
          Login
        </NavbarItem>
        <NavbarItem>
          <Button as={Link} color="primary" href="#" variant="flat">
            Sign Up
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};

export default Menu;
